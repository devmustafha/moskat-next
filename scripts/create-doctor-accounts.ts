/**
 * Create a sign-in account for every active doctor profile that has none, and link it:
 *
 *   npm run auth:create-doctors                 # emails <slug>@moskat.example
 *   npm run auth:create-doctors -- --domain example.org
 *
 * Every account gets the same first password, read from stdin without echoing (so it never lands
 * in shell history). Doctors can change it under Your account. Meant for development and staging
 * databases; it refuses to run against DATABASE_URL_MAIN.
 *
 * Uses from .env: DATABASE_URL (owner connection), BETTER_AUTH_SECRET and PASSWORD_PEPPER. The
 * pepper must be the one the site for that database uses, or the doctors won't be able to sign in.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { APIError } from "better-auth/api";
import { and, asc, eq, exists, isNull } from "drizzle-orm";
import { createAuth } from "@/lib/auth/auth";
import { withDb } from "@/lib/db/client";
import { safeErrorSummary } from "@/lib/db/errors";
import { doctors, users } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";

try {
  process.loadEnvFile();
} catch {}

const { values } = parseArgs({ options: { domain: { type: "string", default: "moskat.example" } } });
const { DATABASE_URL, DATABASE_URL_MAIN, BETTER_AUTH_SECRET, PASSWORD_PEPPER } = process.env;
if (!DATABASE_URL || !BETTER_AUTH_SECRET || !PASSWORD_PEPPER) {
  throw new Error("Set DATABASE_URL, BETTER_AUTH_SECRET and PASSWORD_PEPPER (see .env.example).");
}
if (DATABASE_URL === DATABASE_URL_MAIN) throw new Error("Refusing to create shared-password accounts on production.");
const domain = values.domain!;
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error(`Not a domain: ${domain}`);

/** Reads one line; when interactive, without echoing what's typed. */
async function readSecret(prompt: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (process.stdin.isTTY) {
    process.stdout.write(prompt);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  }
  const line = await new Promise<string>((resolve) => rl.once("line", resolve));
  rl.close();
  if (process.stdin.isTTY) process.stdout.write("\n");
  return line;
}

const password = await readSecret("Password for every new doctor account: ");
if (password.length < siteConfig.auth.minPasswordLength) {
  throw new Error(`The password must be at least ${siteConfig.auth.minPasswordLength} characters.`);
}

try {
  await withDb(DATABASE_URL, async (db) => {
    const auth = createAuth(db, {
      baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      secret: BETTER_AUTH_SECRET,
      pepper: PASSWORD_PEPPER,
    });

    /** Links an unlinked profile to an account whose role is doctor (checked in the same statement). */
    async function link(doctorId: number, userId: string) {
      const linked = await db
        .update(doctors)
        .set({ userId })
        .where(
          and(
            eq(doctors.id, doctorId),
            isNull(doctors.userId),
            exists(db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.role, "doctor")))),
          ),
        )
        .returning({ id: doctors.id });
      return linked.length === 1;
    }

    const profiles = await db
      .select({ id: doctors.id, slug: doctors.slug, name: doctors.name })
      .from(doctors)
      .where(and(eq(doctors.isActive, true), isNull(doctors.userId)))
      .orderBy(asc(doctors.sortOrder), asc(doctors.name));
    if (profiles.length === 0) console.log("Every active doctor profile already has an account.");

    for (const profile of profiles) {
      const email = `${profile.slug}@${domain}`.toLowerCase();
      const [existing] = await db
        .select({ id: users.id, role: users.role, linkedTo: doctors.id })
        .from(users)
        .leftJoin(doctors, eq(doctors.userId, users.id))
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        if (existing.role !== "doctor" || existing.linkedTo !== null) {
          console.log(`${profile.slug}: skipped, ${email} already belongs to another account`);
        } else {
          console.log(`${profile.slug}: ${(await link(profile.id, existing.id)) ? "linked existing account" : "couldn't link"} ${email}`);
        }
        continue;
      }

      let userId: string;
      try {
        ({ user: { id: userId } } = await auth.api.createUser({ body: { name: profile.name, email, password, role: "doctor" } }));
      } catch (error) {
        if (error instanceof APIError) {
          console.log(`${profile.slug}: skipped, ${error.message}`);
          continue;
        }
        throw error;
      }

      if (await link(profile.id, userId)) {
        console.log(`${profile.slug}: created and linked ${email}`);
      } else {
        // Never leave an unlinked doctor account able to sign in.
        await auth.api.banUser({ body: { userId, banReason: "Not linked to a doctor profile" } });
        console.log(`${profile.slug}: created ${email} but couldn't link it, so it has been blocked`);
      }
    }
  });
} catch (error) {
  console.error(`Couldn't create the doctor accounts: ${safeErrorSummary(error)}`);
  process.exitCode = 1;
}
