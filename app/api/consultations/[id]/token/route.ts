import { getConsultationActorOn } from "@/lib/auth/session";
import { isConsultationTokenRateLimited } from "@/lib/booking/rate-limit";
import { AGORA_UID, decideAccess, tokenLifetimeSeconds } from "@/lib/consultation/access";
import { AgoraNotConfiguredError, buildRtcToken } from "@/lib/consultation/agora";
import type { TokenErrorCode, TokenGrant } from "@/lib/consultation/call-ui";
import { isSameOrigin, loggableId, NO_STORE } from "@/lib/consultation/http";
import { findConsultation, openCallFor } from "@/lib/consultation/queries";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";

/**
 * POST /api/consultations/<bookingId>/token: an Agora RTC token for the booking's video call.
 * Used for the first join and for every renewal (the call asks again on token-privilege-will-expire).
 *
 * Every request re-checks, on the server: a signed-in session; that the caller is this booking's
 * patient or doctor (anyone else: 404, as if it didn't exist); that it's paid and confirmed (or in
 * progress) and not ended; and the join window (lib/consultation/access.ts). The channel, uid and
 * role come from the server, never from the request. Tokens are never logged.
 *
 * Node.js runtime: agora-token needs Node's crypto and zlib.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorCode = TokenErrorCode;

const STATUS: Record<ErrorCode, number> = {
  forbidden_origin: 403,
  signed_out: 401,
  not_found: 404,
  rate_limited: 429,
  not_paid: 409,
  cancelled: 409,
  ended: 409,
  too_early: 403,
  closed: 403,
  unavailable: 503,
};

function fail(error: ErrorCode, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return Response.json({ error, ...extra }, { status: STATUS[error], headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return fail("forbidden_origin");
  const { id } = await params;
  const now = new Date();

  try {
    return await runWithDb(async (db) => {
      const { user, actor } = await getConsultationActorOn(db);
      if (!user) return fail("signed_out");
      if (await isConsultationTokenRateLimited(db, user.id, now.getTime())) return fail("rate_limited", {}, { "retry-after": "60" });

      const consultation = actor ? await findConsultation(db, actor, id) : null;
      if (!consultation) return fail("not_found");

      const decision = decideAccess({ role: consultation.role, booking: consultation, call: consultation.call, now });
      if (!decision.ok) {
        return fail(decision.reason, decision.reason === "too_early" ? { opensAt: decision.opensAt.toISOString() } : {});
      }

      const { channelName } = await openCallFor(db, consultation);
      const uid = AGORA_UID[consultation.role];
      const ttl = tokenLifetimeSeconds(now, decision.hardStopAt);
      const { appId, token } = buildRtcToken(channelName, uid, ttl);

      const grant: TokenGrant = {
        appId,
        channel: channelName,
        uid,
        token,
        expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
        role: consultation.role,
        peerUid: AGORA_UID[consultation.role === "doctor" ? "patient" : "doctor"],
        peerName: consultation.role === "doctor" ? consultation.patientName : consultation.doctorName,
        call: {
          startsAt: consultation.startsAt.toISOString(),
          endsAt: consultation.endsAt.toISOString(),
          opensAt: decision.opensAt.toISOString(),
          hardStopAt: decision.hardStopAt.toISOString(),
          status: consultation.status,
        },
      };
      return Response.json(grant, { headers: NO_STORE });
    });
  } catch (error) {
    if (error instanceof AgoraNotConfiguredError) {
      console.error("consultation token: Agora is not configured");
      return fail("unavailable");
    }
    // Booking id only; never the token, channel or query details.
    console.error(`consultation token failed for booking ${loggableId(id)}: ${safeErrorSummary(error)}`);
    return fail("unavailable");
  }
}
