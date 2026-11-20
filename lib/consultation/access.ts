import type { BookingStatus } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";

/**
 * Who may get an Agora token for a booking's video call, and when. Pure and unit-tested; the
 * token endpoint (app/api/consultations/[id]/token) applies it on the server for every token,
 * renewals included.
 *
 * Ownership is decided before this: the booking is looked up through the caller's own session
 * (the patient's account, or the doctor's linked profile), so anyone else never reaches here (404).
 */

export type ConsultationRole = "doctor" | "patient";

/**
 * Agora uids, fixed per role and baked into each token, so a patient's token can never join as
 * the doctor. A second tab with the same uid replaces the first. (Agora: integer uid 1 to 2^32−1.)
 */
export const AGORA_UID: Record<ConsultationRole, number> = { doctor: 1, patient: 2 };

/** The window settings (`siteConfig.consultation`), as plain numbers so tests can vary them. */
export type ConsultationWindowConfig = {
  joinOpensMinutesBefore: number;
  lateJoinMinutesAfterStart: number;
  graceMinutesAfterEnd: number;
  tokenTtlSeconds: number;
};

export type AccessInput = {
  role: ConsultationRole;
  booking: {
    status: BookingStatus;
    startsAt: Date;
    endsAt: Date;
    /** A succeeded payment exists for the booking. */
    paid: boolean;
  };
  /** The call, if one was started already. */
  call: { endedAt: Date | null; doctorJoinedAt: Date | null; patientJoinedAt: Date | null } | null;
  now: Date;
};

export type AccessDecision =
  | { ok: true; opensAt: Date; hardStopAt: Date }
  | { ok: false; reason: "not_paid" | "cancelled" | "ended"; opensAt?: undefined }
  | { ok: false; reason: "too_early"; opensAt: Date }
  | { ok: false; reason: "closed"; opensAt?: undefined };

const MINUTE = 60_000;

export function consultationWindow(booking: { startsAt: Date; endsAt: Date }, config: ConsultationWindowConfig = siteConfig.consultation) {
  return {
    opensAt: new Date(booking.startsAt.getTime() - config.joinOpensMinutesBefore * MINUTE),
    lateJoinUntil: new Date(booking.startsAt.getTime() + config.lateJoinMinutesAfterStart * MINUTE),
    hardStopAt: new Date(booking.endsAt.getTime() + config.graceMinutesAfterEnd * MINUTE),
  };
}

export function decideAccess({ role, booking, call, now }: AccessInput, config: ConsultationWindowConfig = siteConfig.consultation): AccessDecision {
  switch (booking.status) {
    case "cancelled":
      return { ok: false, reason: "cancelled" };
    case "pending_payment":
      return { ok: false, reason: "not_paid" };
    case "completed":
    case "no_show":
      return { ok: false, reason: "ended" };
    case "confirmed":
    case "in_progress":
      break;
  }
  // Confirmed bookings from before online payment have no payment: they can't use video.
  if (!booking.paid) return { ok: false, reason: "not_paid" };
  if (call?.endedAt) return { ok: false, reason: "ended" };

  const { opensAt, lateJoinUntil, hardStopAt } = consultationWindow(booking, config);
  const t = now.getTime();
  if (t < opensAt.getTime()) return { ok: false, reason: "too_early", opensAt };
  if (t >= hardStopAt.getTime()) return { ok: false, reason: "closed" };

  // Late first joins are refused; someone already in the call can renew or reconnect until the hard stop.
  const joinedAt = role === "doctor" ? call?.doctorJoinedAt : call?.patientJoinedAt;
  if (!joinedAt && t > lateJoinUntil.getTime()) return { ok: false, reason: "closed" };

  return { ok: true, opensAt, hardStopAt };
}

/** Minimum token lifetime, so a token issued just before the hard stop is still usable. */
export const MIN_TOKEN_TTL_SECONDS = 60;

/**
 * Seconds a token (and its privileges, set equal as Agora recommends) should last: the configured
 * TTL, but never past the hard stop, and at least a minute. Agora's maximum is 24 hours.
 */
export function tokenLifetimeSeconds(now: Date, hardStopAt: Date, config: Pick<ConsultationWindowConfig, "tokenTtlSeconds"> = siteConfig.consultation) {
  const untilHardStop = Math.floor((hardStopAt.getTime() - now.getTime()) / 1000);
  const ttl = Math.min(config.tokenTtlSeconds, untilHardStop, 24 * 60 * 60);
  return Math.max(MIN_TOKEN_TTL_SECONDS, ttl);
}
