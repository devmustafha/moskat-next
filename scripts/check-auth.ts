/**
 * Access check for sign-in, roles and the protected areas, over HTTP against a running site:
 *
 *   npm run auth:check -- --base-url http://localhost:3000   (or a Vercel preview URL)
 *
 * Creates patients A and B, doctors X and Y (linked to two doctor profiles), an unlinked doctor Z
 * and an admin, gives them bookings, then asserts what each may see, plus session, cookie and
 * abuse rules. Everything it creates is deleted at the end.
 *
 * Uses the owner DATABASE_URL from .env for setup, so it must point at the database behind
 * `--base-url`. It refuses to run against production (DATABASE_URL_MAIN, or PRODUCTION_URL if set).
 * When the site can issue Agora tokens, it also checks the call's attendance, status and "End for
 * both" endpoints. It runs the daily maintenance job once, and ends by tripping the sign-in rate
 * limit, which blocks sign-in from this machine for a minute.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { Client } from "pg";
import { withDb } from "@/lib/db/client";
import { runMaintenance } from "@/lib/db/maintenance";
import { siteConfig } from "@/lib/site";

try {
  process.loadEnvFile();
} catch {}

const { values } = parseArgs({ options: { "base-url": { type: "string" } } });
const base = values["base-url"]?.replace(/\/$/, "");
const { DATABASE_URL, DATABASE_URL_MAIN, PRODUCTION_URL } = process.env;
if (!base) throw new Error("Usage: npm run auth:check -- --base-url <site origin>");
if (!DATABASE_URL) throw new Error("Set DATABASE_URL (the database behind --base-url).");
if ((PRODUCTION_URL && base === PRODUCTION_URL.replace(/\/$/, "")) || DATABASE_URL === DATABASE_URL_MAIN) {
  throw new Error("Refusing to run against production.");
}

const origin = new URL(base).origin;
const secure = origin.startsWith("https://");
const run = Date.now().toString(36);
const password = randomBytes(12).toString("base64url");
const emailOf = (who: string) => `check-${run}-${who.toLowerCase()}@example.test`;

// Results ------------------------------------------------------------------------------------

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}

// HTTP with a cookie jar per user -----------------------------------------------------------

const NETWORK_ERRORS = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket/i;

class Visitor {
  cookies = new Map<string, string>();
  lastSetCookie: string[] = [];

  async request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { origin, ...init.headers };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    if (init.body !== undefined) headers["content-type"] = "application/json";
    // Retry dropped connections (slow links); never retry a response.
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(`${base}${path}`, {
          method: init.method ?? "GET",
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          redirect: "manual",
          signal: AbortSignal.timeout(90_000),
        });
        this.lastSetCookie = response.headers.getSetCookie();
        for (const line of this.lastSetCookie) {
          const [pair] = line.split(";");
          const at = pair.indexOf("=");
          const name = pair.slice(0, at);
          const value = pair.slice(at + 1);
          // Better Auth clears cookies with an empty value / Max-Age=0.
          if (!value || /max-age=0/i.test(line)) this.cookies.delete(name);
          else this.cookies.set(name, value);
        }
        return response;
      } catch (error) {
        if (attempt >= 5 || !(error instanceof Error) || !NETWORK_ERRORS.test(`${error.message} ${String(error.cause)}`)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      }
    }
  }

  post(path: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request(path, { method: "POST", body, headers });
  }
}

/** Status of a page, and where a redirect points (path + search). */
async function page(visitor: Visitor, path: string) {
  const response = await visitor.request(path);
  const location = response.headers.get("location");
  await response.body?.cancel();
  return { status: response.status, location: location ? new URL(location, base).pathname + new URL(location, base).search : null, response };
}

async function text(visitor: Visitor, path: string) {
  const response = await visitor.request(path);
  return { status: response.status, body: await response.text() };
}

// Owner database, for setup ----------------------------------------------------------------

async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  for (let attempt = 1; ; attempt++) {
    const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 30_000 });
    client.on("error", () => {});
    try {
      await client.connect();
      return (await client.query(query, params)).rows as T[];
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      const network = ["ETIMEDOUT", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN", "ENOTFOUND"].includes(code);
      if (!network || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    } finally {
      await client.end().catch(() => {});
    }
  }
}

// The check --------------------------------------------------------------------------------

const who = ["A", "B", "X", "Y", "Z", "Admin"] as const;
type Who = (typeof who)[number];
const visitors = Object.fromEntries(who.map((name) => [name, new Visitor()])) as Record<Who, Visitor>;
const ids = {} as Record<Who, string>;
const linkedSlugs: string[] = [];

async function signUp(name: Who) {
  const response = await visitors[name].post("/api/auth/sign-up/email", { name: `Check ${name} ${run}`, email: emailOf(name), password });
  if (response.status !== 200) throw new Error(`Sign-up for ${name} failed with ${response.status}: ${await response.text()}`);
  ids[name] = ((await response.json()) as { user: { id: string } }).user.id;
}

/**
 * Inserts a booking for setup, far in the future so it never collides with real ones (unless
 * `startsAt` is given).
 */
async function insertBooking(slug: string, patient: Who, status: "confirmed" | "cancelled", hourOffset: number, startsAt = startFor(hourOffset)) {
  const [row] = await sql<{ id: string; reference: string }>(
    `insert into consultation_bookings
       (reference, manage_token_hash, doctor_id, starts_at, ends_at, status, fee_cents, currency,
        patient_name, patient_email, patient_user_id, consented_at, cancelled_at, cancelled_by)
     select $1, encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'), d.id,
            $2::timestamptz, $2::timestamptz + make_interval(mins => d.consultation_minutes), $3::booking_status,
            d.consultation_fee_cents, d.currency, $4, $5, $6, now(),
            case when $3 = 'cancelled' then now() end, case when $3 = 'cancelled' then 'patient'::cancelled_by end
     from doctors d where d.slug = $7
     returning id, reference`,
    [`CHK-${run.slice(-5).toUpperCase()}${hourOffset}`, startsAt, status, `Check ${patient} ${run}`, emailOf(patient), ids[patient], slug],
  );
  if (!row) throw new Error(`Doctor ${slug} not found`);
  return row;
}

/** A start time in 2099, unique per run, on the hour; offsets are 3 h apart so bookings never overlap. */
function startFor(slot: number) {
  const hours = (Number.parseInt(run, 36) % 2000) * 4 * 3 + slot * 3;
  return new Date(Date.UTC(2099, 0, 1) + hours * 3_600_000).toISOString();
}

/** The session token inside a Better Auth session cookie ("<token>.<signature>"). */
function sessionToken(visitor: Visitor) {
  const value = [...visitor.cookies].find(([name]) => name.endsWith("moskat.session_token"))?.[1];
  return value ? decodeURIComponent(value).split(".")[0] : null;
}

try {
  console.log(`Checking ${base} (run ${run})\n`);

  // Signed out.
  {
    const visitor = new Visitor();
    for (const path of ["/account", "/account/bookings", "/doctor/queue", "/doctor/hours", "/doctor/profile", "/admin/doctors"]) {
      const r = await page(visitor, path);
      check(`signed out: ${path} → sign-in`, r.status >= 300 && r.status < 400 && r.location === `/sign-in?next=${encodeURIComponent(path)}`, `${r.status} ${r.location}`);
    }
  }

  // Accounts.
  for (const name of who) await signUp(name);
  const [slugX, slugY] = (
    await sql<{ slug: string }>("select slug from doctors where is_active and user_id is null order by sort_order, name limit 2")
  ).map((row) => row.slug);
  if (!slugY) throw new Error("Need two active, unlinked doctor profiles");
  await sql("update users set role = 'doctor' where id = any($1)", [[ids.X, ids.Y, ids.Z]]);
  await sql("update users set role = 'admin' where id = $1", [ids.Admin]);
  for (const [name, slug] of [["X", slugX], ["Y", slugY]] as const) {
    await sql("update doctors set user_id = $1 where slug = $2 and user_id is null", [ids[name], slug]);
    linkedSlugs.push(slug);
  }
  const AX = await insertBooking(slugX, "A", "confirmed", 0);
  const BY = await insertBooking(slugY, "B", "confirmed", 1);
  const AY = await insertBooking(slugY, "A", "cancelled", 2);
  console.log(`Setup: X → ${slugX}, Y → ${slugY}, Z unlinked; bookings A–X ${AX.reference}, B–Y ${BY.reference}, A–Y ${AY.reference} (cancelled)\n`);

  // Cookie attributes, from A's sign-up response.
  {
    const visitor = new Visitor();
    await visitor.post("/api/auth/sign-in/email", { email: emailOf("A"), password });
    const cookie = visitor.lastSetCookie.find((line) => line.includes("moskat.session_token="));
    const name = cookie?.split("=")[0];
    check("session cookie name", name === (secure ? "__Secure-moskat.session_token" : "moskat.session_token"), name);
    check("session cookie is HttpOnly, SameSite=Lax, Path=/", Boolean(cookie && /httponly/i.test(cookie) && /samesite=lax/i.test(cookie) && /path=\//i.test(cookie)), cookie?.split(";").slice(1).join(";"));
    check("session cookie is Secure on https", !secure || Boolean(cookie && /;\s*secure/i.test(cookie)));
    check("session cookie has no Domain (host-only)", Boolean(cookie && !/domain=/i.test(cookie)));
  }

  // Privacy headers on signed-in pages.
  {
    const { response } = await page(visitors.A, "/account");
    const h = response.headers;
    check("/account: Cache-Control private, no-store", h.get("cache-control")?.includes("no-store") === true, h.get("cache-control") ?? "");
    check("/account: X-Robots-Tag noindex", h.get("x-robots-tag")?.includes("noindex") === true, h.get("x-robots-tag") ?? "");
    check("/account: Referrer-Policy no-referrer", h.get("referrer-policy") === "no-referrer", h.get("referrer-policy") ?? "");
  }

  // Patient A.
  {
    const list = await text(visitors.A, "/account/bookings");
    check("A: /account/bookings 200 with A's booking only", list.status === 200 && list.body.includes(AX.reference) && !list.body.includes(BY.reference), `${list.status}`);
    let r = await page(visitors.A, `/account/bookings/${BY.id}`);
    check("A: B's booking is 404", r.status === 404, `${r.status}`);
    for (const path of ["/doctor/queue", "/doctor/hours", "/doctor/profile", "/admin/bookings"]) {
      r = await page(visitors.A, path);
      check(`A: ${path} 403`, r.status === 403, `${r.status}`);
    }
    let res = await visitors.A.post("/api/auth/admin/create-user", { email: emailOf("sneaky"), password, name: "Sneaky", role: "admin" });
    check("A: POST admin/create-user 403", res.status === 403, `${res.status}`);
    res = await visitors.A.post("/api/auth/admin/set-role", { userId: ids.A, role: "admin" });
    check("A: POST admin/set-role 403", res.status === 403, `${res.status}`);
  }

  // Doctors.
  {
    const queue = await text(visitors.X, "/doctor/queue");
    check("X: /doctor/queue 200 with X's bookings only", queue.status === 200 && queue.body.includes(AX.reference) && !queue.body.includes(BY.reference), `${queue.status}`);
    let r = await page(visitors.X, `/doctor/patients/${ids.A}`);
    check("X: /doctor/patients/<A> 200", r.status === 200, `${r.status}`);
    r = await page(visitors.X, `/doctor/patients/${ids.B}`);
    check("X: /doctor/patients/<B> 404 (B only booked Y)", r.status === 404, `${r.status}`);
    r = await page(visitors.Y, `/doctor/patients/${ids.A}`);
    check("Y: /doctor/patients/<A> 404 (A's only booking with Y is cancelled)", r.status === 404, `${r.status}`);
    for (const path of ["/admin/doctors", "/account/bookings"]) {
      r = await page(visitors.X, path);
      check(`X: ${path} 403`, r.status === 403, `${r.status}`);
    }
    for (const path of ["/doctor/hours", "/doctor/profile"]) {
      r = await page(visitors.X, path);
      check(`X: ${path} 200`, r.status === 200, `${r.status}`);
    }
    for (const path of ["/doctor/queue", "/doctor/hours", "/doctor/profile"]) {
      r = await page(visitors.Z, path);
      check(`Z (unlinked): ${path} → not-linked page`, r.status >= 300 && r.status < 400 && r.location === "/doctor/not-linked", `${r.status} ${r.location}`);
    }
    const notLinked = await text(visitors.Z, "/doctor/not-linked");
    check("Z: not-linked page shows no bookings", notLinked.status === 200 && !notLinked.body.includes("CHK-"), `${notLinked.status}`);
  }

  // Video call tokens (before the session checks below, which sign people out).
  {
    const tokenFor = async (visitor: Visitor, bookingId: string, headers?: Record<string, string>) => {
      const response = await visitor.post(`/api/consultations/${bookingId}/token`, {}, headers);
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: response.status, body, cacheControl: response.headers.get("cache-control") ?? "" };
    };
    const pay = (bookingId: string) =>
      sql(
        `insert into payments (booking_id, reference, amount_minor, currency, status, paid_at)
         select id, 'CHK-PAY-' || reference, fee_cents, currency, 'succeeded', now() from consultation_bookings where id = $1`,
        [bookingId],
      );

    // A paid consultation with X that started a minute ago, so its call is open now.
    const live = await insertBooking(slugX, "A", "confirmed", 3, new Date(Math.floor(Date.now() / 60_000) * 60_000 - 60_000).toISOString());
    await pay(live.id);

    let r = await tokenFor(new Visitor(), live.id);
    check("token: signed out → 401", r.status === 401, `${r.status}`);
    r = await tokenFor(visitors.A, live.id, { origin: "https://evil.example" });
    check("token: from another origin → 403", r.status === 403, `${r.status}`);
    for (const [name, label] of [["B", "another patient"], ["Y", "another doctor"], ["Z", "an unlinked doctor"], ["Admin", "an admin"]] as const) {
      r = await tokenFor(visitors[name], live.id);
      check(`token: ${label} (${name}) → 404`, r.status === 404 && r.body.error === "not_found", `${r.status} ${String(r.body.error)}`);
    }
    r = await tokenFor(visitors.A, BY.id);
    check("token: A for B's booking → 404", r.status === 404, `${r.status}`);
    r = await tokenFor(visitors.A, AX.id);
    check("token: confirmed but unpaid → 409 not_paid", r.status === 409 && r.body.error === "not_paid", `${r.status} ${String(r.body.error)}`);
    await pay(AX.id);
    r = await tokenFor(visitors.A, AX.id);
    check("token: paid, before the window → 403 too_early", r.status === 403 && r.body.error === "too_early" && typeof r.body.opensAt === "string", `${r.status} ${String(r.body.error)}`);
    r = await tokenFor(visitors.A, AY.id);
    check("token: cancelled → 409", r.status === 409 && r.body.error === "cancelled", `${r.status} ${String(r.body.error)}`);

    const patient = await tokenFor(visitors.A, live.id);
    if (patient.status === 503) {
      console.log("NOTE  token: issuing skipped (503): set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the site to check it");
    } else {
      const doctor = await tokenFor(visitors.X, live.id);
      check(
        "token: the patient gets one as uid 2",
        patient.status === 200 && patient.body.uid === 2 && patient.body.role === "patient" && typeof patient.body.token === "string",
        `${patient.status} uid=${String(patient.body.uid)}`,
      );
      check(
        "token: the doctor gets one as uid 1, for the same random channel",
        doctor.status === 200 && doctor.body.uid === 1 && doctor.body.channel === patient.body.channel && /^[0-9a-f]{32}$/.test(String(patient.body.channel)),
        `${doctor.status} uid=${String(doctor.body.uid)}`,
      );
      check("token: response is never cached", patient.cacheControl.includes("no-store"), patient.cacheControl);
      const pe = patient.body.encryption as { mode?: string; secret?: string; salt?: string } | undefined;
      const de = doctor.body.encryption as typeof pe;
      check(
        "token: media encryption is aes-256-gcm2, the same secret and salt for both",
        pe?.mode === "aes-256-gcm2" && typeof pe.secret === "string" && pe.secret.length >= 32 && typeof pe.salt === "string" && pe.secret === de?.secret && pe.salt === de?.salt,
        `mode=${String(pe?.mode)} same=${String(pe?.secret === de?.secret && pe?.salt === de?.salt)}`,
      );

      // Attendance, status and "End for both" (needs the call row the tokens created).
      const callApi = async (visitor: Visitor, bookingId: string, action: "attendance" | "end" | "status", body?: unknown, headers?: Record<string, string>) => {
        const path = `/api/consultations/${bookingId}/${action}`;
        const response = action === "status" ? await visitor.request(path, { headers }) : await visitor.request(path, { method: "POST", body: body ?? {}, headers });
        const json = response.status === 204 ? {} : ((await response.json().catch(() => ({}))) as Record<string, unknown>);
        return { status: response.status, body: json, cacheControl: response.headers.get("cache-control") ?? "" };
      };
      const joined = { event: "joined" };

      let c = await callApi(new Visitor(), live.id, "attendance", joined);
      check("attendance: signed out → 401", c.status === 401, `${c.status}`);
      c = await callApi(visitors.A, live.id, "attendance", joined, { origin: "https://evil.example" });
      check("attendance: from another origin → 403", c.status === 403, `${c.status}`);
      c = await callApi(visitors.A, live.id, "attendance", { event: "teleported" });
      check("attendance: unknown event → 400", c.status === 400, `${c.status}`);
      c = await callApi(visitors.B, live.id, "attendance", joined);
      check("attendance: another patient → 404", c.status === 404, `${c.status}`);
      c = await callApi(visitors.A, AX.id, "attendance", joined);
      check("attendance: before any token → 409 no_call", c.status === 409 && c.body.error === "no_call", `${c.status} ${String(c.body.error)}`);

      c = await callApi(visitors.X, live.id, "attendance", joined);
      check("attendance: the doctor joins → 204", c.status === 204, `${c.status}`);
      c = await callApi(visitors.X, live.id, "end");
      check("end: before the patient joined → 409 not_started", c.status === 409 && c.body.error === "not_started", `${c.status} ${String(c.body.error)}`);
      c = await callApi(visitors.A, live.id, "status");
      check("status: not started yet", c.status === 200 && c.body.started === false && c.body.ended === false, `${c.status} ${JSON.stringify(c.body)}`);

      c = await callApi(visitors.A, live.id, "attendance", joined);
      check("attendance: the patient joins → 204", c.status === 204, `${c.status}`);
      const [afterJoin] = await sql<{ status: string; started: boolean }>(
        "select b.status, c.started_at is not null as started from consultation_bookings b join consultation_calls c on c.booking_id = b.id where b.id = $1",
        [live.id],
      );
      check("attendance: both in the call → booking in_progress, started_at set", afterJoin?.status === "in_progress" && afterJoin.started, JSON.stringify(afterJoin));
      c = await callApi(visitors.X, live.id, "status");
      check("status: started, not ended, never cached", c.status === 200 && c.body.started === true && c.body.ended === false && c.cacheControl.includes("no-store"), `${c.status} ${JSON.stringify(c.body)}`);
      c = await callApi(visitors.Y, live.id, "status");
      check("status: another doctor → 404", c.status === 404, `${c.status}`);

      c = await callApi(visitors.A, live.id, "end");
      check("end: the patient → 403 doctor_only", c.status === 403 && c.body.error === "doctor_only", `${c.status} ${String(c.body.error)}`);
      c = await callApi(visitors.Y, live.id, "end");
      check("end: another doctor → 404", c.status === 404, `${c.status}`);
      c = await callApi(visitors.X, live.id, "end", {}, { origin: "https://evil.example" });
      check("end: from another origin → 403", c.status === 403, `${c.status}`);
      const ended = await callApi(visitors.X, live.id, "end");
      check("end: the doctor ends it for both → 200 completed", ended.status === 200 && ended.body.status === "completed" && typeof ended.body.durationSeconds === "number", `${ended.status} ${JSON.stringify(ended.body)}`);
      c = await callApi(visitors.X, live.id, "end");
      check("end: repeating it returns the same end", c.status === 200 && c.body.endedAt === ended.body.endedAt, `${c.status} ${JSON.stringify(c.body)}`);

      c = await callApi(visitors.A, live.id, "status");
      check("status: the patient sees it ended by the doctor", c.status === 200 && c.body.ended === true && c.body.endedBy === "doctor", `${c.status} ${JSON.stringify(c.body)}`);
      r = await tokenFor(visitors.A, live.id);
      check("token: after the end → 409 ended", r.status === 409 && r.body.error === "ended", `${r.status} ${String(r.body.error)}`);
      c = await callApi(visitors.A, live.id, "attendance", joined);
      check("attendance: joining after the end → 409 ended", c.status === 409 && c.body.error === "ended", `${c.status} ${String(c.body.error)}`);
      const [afterEnd] = await sql<{ status: string; ended_by: string; patient_left: boolean }>(
        "select b.status, c.ended_by, c.patient_left_at is not null as patient_left from consultation_bookings b join consultation_calls c on c.booking_id = b.id where b.id = $1",
        [live.id],
      );
      check("end: booking completed, ended by the doctor, patient marked left", afterEnd?.status === "completed" && afterEnd.ended_by === "doctor" && afterEnd.patient_left, JSON.stringify(afterEnd));
    }
  }

  // Admin.
  {
    for (const path of ["/admin/bookings", "/admin/doctors", "/admin/pricing", "/admin/departments"]) {
      const r = await page(visitors.Admin, path);
      check(`Admin: ${path} 200`, r.status === 200, `${r.status}`);
    }
    for (const path of ["/doctor/queue", "/doctor/hours", "/doctor/profile", `/doctor/patients/${ids.A}`]) {
      const r = await page(visitors.Admin, path);
      check(`Admin: ${path} 403`, r.status === 403, `${r.status}`);
    }
    let res = await visitors.Admin.post("/api/auth/admin/impersonate-user", { userId: ids.X });
    check("Admin: POST admin/impersonate-user 403", res.status === 403, `${res.status}`);
    res = await visitors.Admin.post("/api/auth/admin/set-role", { userId: ids.Admin, role: "patient" });
    check("Admin: set-role on self refused", res.status === 403, `${res.status}`);
    res = await visitors.Admin.post("/api/auth/admin/ban-user", { userId: ids.Admin });
    check("Admin: ban self refused", res.status === 403, `${res.status}`);
  }

  // Sign-up can't choose a role.
  {
    const email = emailOf("rolesignup");
    const res = await new Visitor().post("/api/auth/sign-up/email", { email, password, name: "Role Sneak", role: "admin" });
    const [row] = await sql<{ role: string }>("select role from users where email = $1", [email]);
    check('sign-up with "role":"admin" never creates an admin', (res.status === 400 && !row) || (res.status === 200 && row?.role === "patient"), `${res.status} ${row?.role ?? "no account"}`);
  }

  // Sessions.
  {
    // Role change applies on the next request (no cookie cache).
    await sql("update users set role = 'doctor' where id = $1", [ids.B]);
    let r = await page(visitors.B, "/account/bookings");
    check("role change applies at once (B made a doctor → 403)", r.status === 403, `${r.status}`);
    await sql("update users set role = 'patient' where id = $1", [ids.B]);

    // Ban: the banned doctor's open session stops working.
    const res = await visitors.Admin.post("/api/auth/admin/ban-user", { userId: ids.Y, banReason: "auth check" });
    r = await page(visitors.Y, "/doctor/queue");
    check("ban: banned doctor's session is signed out", res.status === 200 && r.status >= 300 && r.status < 400 && r.location?.startsWith("/sign-in") === true, `${res.status} → ${r.status} ${r.location}`);

    // Idle timeout and absolute lifetime.
    await sql("update sessions set expires_at = now() - interval '1 minute' where user_id = $1", [ids.Z]);
    r = await page(visitors.Z, "/account");
    check("idle timeout: expired session is signed out", r.status >= 300 && r.status < 400, `${r.status} ${r.location}`);
    const hours = siteConfig.auth.absoluteLifetimeHours + 1;
    await sql(`update sessions set created_at = now() - interval '${hours} hours' where user_id = $1`, [ids.X]);
    r = await page(visitors.X, "/account");
    check(`absolute limit: session created ${hours} h ago is signed out`, r.status >= 300 && r.status < 400, `${r.status} ${r.location}`);

    // Sign-out: the old cookie stops working and its session row is gone.
    const before = new Map(visitors.A.cookies);
    const token = sessionToken(visitors.A);
    const out = await visitors.A.post("/api/auth/sign-out");
    const stale = new Visitor();
    stale.cookies = before;
    r = await page(stale, "/account");
    const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from sessions where token = $1", [token]);
    check("sign-out: old cookie signed out, session row gone", Boolean(token) && out.status === 200 && r.status >= 300 && r.status < 400 && n === 0, `${out.status} → ${r.status}, ${n} rows`);

    // The daily job deletes sessions that expired over a day ago. (X's session is still in the
    // table: the absolute limit is enforced by our wrapper, which doesn't delete it.)
    await sql("update sessions set expires_at = now() - interval '2 days' where user_id = $1", [ids.X]);

    // A paid consultation two days ago that only the doctor joined: the job closes its call and
    // marks it missed.
    const past = await insertBooking(slugX, "A", "confirmed", 4, new Date(Math.floor(Date.now() / 60_000) * 60_000 - 2 * 86_400_000).toISOString());
    await sql(
      `insert into payments (booking_id, reference, amount_minor, currency, status, paid_at)
       select id, 'CHK-PAY-' || reference, fee_cents, currency, 'succeeded', now() from consultation_bookings where id = $1`,
      [past.id],
    );
    await sql(
      `insert into consultation_calls (booking_id, channel_name, doctor_joined_at, doctor_left_at)
       select id, md5(random()::text), starts_at - interval '2 minutes', ends_at from consultation_bookings where id = $1`,
      [past.id],
    );

    const result = await withDb(DATABASE_URL, (db) => runMaintenance(db, new Date()));
    const [{ left }] = await sql<{ left: number }>("select count(*)::int as left from sessions where user_id = $1", [ids.X]);
    check("daily job deletes long-expired sessions", left === 0 && result.expiredSessions >= 1, `deleted ${result.expiredSessions}, ${left} left`);
    const [closed] = await sql<{ status: string; ended_by: string | null }>(
      "select b.status, c.ended_by from consultation_bookings b join consultation_calls c on c.booking_id = b.id where b.id = $1",
      [past.id],
    );
    check("daily job: a call only the doctor joined is closed and the booking missed", closed?.status === "no_show" && closed.ended_by === "system", JSON.stringify(closed));
  }

  // Abuse protection.
  {
    const res = await new Visitor().post("/api/auth/sign-in/email", { email: emailOf("A"), password }, { origin: "https://evil.example" });
    check("sign-in from another origin is rejected", res.status === 403, `${res.status}`);

    // Last, because it blocks sign-in from this machine for a minute.
    const attacker = new Visitor();
    // Earlier sign-ins in this run count too, so the limit may be reached before attempt 11.
    const limit = siteConfig.auth.attemptsPerMinute;
    const statuses: number[] = [];
    for (let i = 0; i <= limit && !statuses.includes(429); i++) {
      statuses.push((await attacker.post("/api/auth/sign-in/email", { email: emailOf("B"), password: "wrong-password-123" })).status);
    }
    const refusedBefore = statuses.slice(0, -1).every((status) => status === 401);
    check(`sign-in is refused with 429 by attempt ${limit + 1} in a minute`, statuses.at(-1) === 429 && refusedBefore, statuses.join(","));
  }
} catch (error) {
  check("check ran to completion", false, error instanceof Error ? error.message : String(error));
} finally {
  // Remove everything this run created: calls, payments, bookings, profile links and accounts
  // (sessions cascade).
  try {
    const mine = "select id from consultation_bookings where reference like $1";
    const prefix = [`CHK-${run.slice(-5).toUpperCase()}%`];
    await sql(`delete from consultation_calls where booking_id in (${mine})`, prefix);
    await sql(`delete from payments where booking_id in (${mine})`, prefix);
    await sql("delete from consultation_bookings where reference like $1", prefix);
    await sql("update doctors set user_id = null where slug = any($1)", [linkedSlugs]);
    await sql("delete from users where email like $1", [`check-${run}-%@example.test`]);
  } catch (error) {
    console.log(`\nCleanup failed (${(error as { code?: string }).code ?? "error"}): remove check-${run}-* users and CHK-${run.slice(-5).toUpperCase()}* bookings by hand.`);
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exitCode = failures ? 1 : 0;
