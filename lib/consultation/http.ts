import "server-only";
import { getConsultationActorOn } from "@/lib/auth/session";
import { isConsultationCallRateLimited } from "@/lib/booking/rate-limit";
import type { Db } from "@/lib/db/client";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { siteOrigin } from "@/lib/origin";
import type { CallErrorCode } from "./call-ui";
import { type Consultation, findConsultation } from "./queries";

/**
 * Shared by the video-call route handlers under app/api/consultations/[id]/: responses are never
 * cached, POSTs must come from the site itself, and logs carry the booking id only.
 */

export const NO_STORE = { "cache-control": "private, no-store" };

/**
 * Same-origin requests only (the session cookie is SameSite=Lax; this is the second guard). The
 * call screen uses fetch(), whose same-origin requests always carry the real Origin; a beacon
 * (sendBeacon) would send "Origin: null" under the pages' no-referrer policy, so it isn't used.
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(siteOrigin()).origin;
}

/** The booking id for a log line, or a placeholder if the URL held something else. */
export function loggableId(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id) ? id : "(invalid id)";
}

const STATUS: Record<CallErrorCode, number> = {
  forbidden_origin: 403,
  bad_request: 400,
  signed_out: 401,
  not_found: 404,
  rate_limited: 429,
  no_call: 409,
  doctor_only: 403,
  not_started: 409,
  not_active: 409,
  ended: 409,
  closed: 403,
  unavailable: 503,
};

export function callError(error: CallErrorCode, headers: Record<string, string> = {}) {
  return Response.json({ error }, { status: STATUS[error], headers: { ...NO_STORE, ...headers } });
}

/**
 * Runs `handle` for the signed-in participant's own consultation `id`: signed out → 401, over
 * the per-user limit → 429, anyone but the booking's patient or doctor → 404 (as if it didn't
 * exist). Unexpected errors → 503, logged with the booking id and an error summary only.
 */
export async function forParticipant(
  request: Request,
  id: string,
  label: string,
  handle: (db: Db, consultation: Consultation, now: Date) => Promise<Response>,
  { checkOrigin = true }: { checkOrigin?: boolean } = {},
) {
  if (checkOrigin && !isSameOrigin(request)) return callError("forbidden_origin");
  const now = new Date();
  try {
    return await runWithDb(async (db) => {
      const { user, actor } = await getConsultationActorOn(db);
      if (!user) return callError("signed_out");
      if (await isConsultationCallRateLimited(db, user.id, now.getTime())) return callError("rate_limited", { "retry-after": "60" });
      const consultation = actor ? await findConsultation(db, actor, id) : null;
      if (!consultation) return callError("not_found");
      return handle(db, consultation, now);
    });
  } catch (error) {
    console.error(`consultation ${label} failed for booking ${loggableId(id)}: ${safeErrorSummary(error)}`);
    return callError("unavailable");
  }
}
