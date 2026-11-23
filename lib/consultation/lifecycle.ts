import { canTransition } from "@/lib/booking/status";
import type { BookingStatus } from "@/lib/db/schema";
import { formatTime } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { type ConsultationRole, type ConsultationWindowConfig, consultationWindow } from "./access";

/**
 * What happens to a video call after the token: who is in it, when it started, ending it, and
 * closing it at the hard stop. Pure and unit-tested; lib/consultation/queries.ts and the daily
 * job (lib/db/maintenance.ts) apply it.
 *
 * Attendance comes from the call screen: "joined" once Agora has let the participant in, "left"
 * when they leave, close the tab or lose the call. Someone is present from their latest "joined"
 * until their next "left" (a rejoin clears their left time). The call has started once both were
 * present at the same time; that moves the booking to `in_progress`.
 */

export type CallAttendance = {
  doctorJoinedAt: Date | null;
  patientJoinedAt: Date | null;
  doctorLeftAt: Date | null;
  patientLeftAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
};

export type AttendanceEvent = "joined" | "left";

export function isPresent(call: CallAttendance, role: ConsultationRole) {
  return role === "doctor" ? call.doctorJoinedAt !== null && call.doctorLeftAt === null : call.patientJoinedAt !== null && call.patientLeftAt === null;
}

/** Whole seconds from `from` to `to`, never negative. */
export function secondsBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

// Ending the call (the doctor's "End for both") ------------------------------------------------

export type EndDecision =
  | { ok: true; durationSeconds: number }
  /** Already ended: answer with what was recorded, so a repeated request is harmless. */
  | { ok: false; reason: "already_ended" }
  | { ok: false; reason: "doctor_only" | "not_active" | "not_started" };

/**
 * Whether `role` may end the call for both now. Only the doctor, and only once the call has
 * started (both were in it): before that the doctor can only leave, so an early click can never
 * lock the patient out of a consultation they paid for.
 */
export function decideEnd({ role, status, call, now }: { role: ConsultationRole; status: BookingStatus; call: CallAttendance | null; now: Date }): EndDecision {
  if (role !== "doctor") return { ok: false, reason: "doctor_only" };
  if (call?.endedAt) return { ok: false, reason: "already_ended" };
  if (status !== "in_progress" && status !== "confirmed") return { ok: false, reason: "not_active" };
  if (!call?.startedAt) return { ok: false, reason: "not_started" };
  return { ok: true, durationSeconds: secondsBetween(call.startedAt, now) };
}

// Closing calls at the hard stop (daily job) ----------------------------------------------------

export type ClosePlan = {
  /** End the open call (by `system`) at this time, with this duration (null if it never started). */
  callEnd: { endedAt: Date; durationSeconds: number | null } | null;
  /** Move the booking to this status (checked with canTransition), or leave it for staff. */
  booking: "completed" | "no_show" | null;
};

/**
 * When the call stopped: the last time someone left, if nobody is still marked present (no later
 * than the hard stop, no earlier than the start); otherwise the hard stop itself, as someone's
 * browser never said they left.
 */
function closingTime(call: CallAttendance, hardStopAt: Date) {
  if (isPresent(call, "doctor") || isPresent(call, "patient")) return hardStopAt;
  const lefts = [call.doctorLeftAt, call.patientLeftAt].filter((t): t is Date => t !== null).map((t) => t.getTime());
  if (lefts.length === 0) return hardStopAt;
  const last = Math.min(Math.max(...lefts), hardStopAt.getTime());
  return new Date(Math.max(last, call.startedAt?.getTime() ?? last));
}

/**
 * What the daily job does with a consultation once its hard stop (end + grace) has passed, or
 * null before then:
 * - A call that started is closed and the booking completed.
 * - The doctor joined but the patient never did: the booking becomes `no_show`.
 * - The doctor never joined (or they were never in it at the same time): the booking is left as
 *   it is for staff, who see the attendance on /admin/bookings and can cancel it (flagging the
 *   payment for a refund) or mark it missed.
 * Any call row still open is closed either way, so it never stays "in progress".
 */
export function planClose(
  { status, paid, call, endsAt, now }: { status: BookingStatus; paid: boolean; call: CallAttendance | null; endsAt: Date; now: Date },
  config: Pick<ConsultationWindowConfig, "graceMinutesAfterEnd"> = siteConfig.consultation,
): ClosePlan | null {
  const hardStopAt = new Date(endsAt.getTime() + config.graceMinutesAfterEnd * 60_000);
  if (now.getTime() < hardStopAt.getTime()) return null;

  let callEnd: ClosePlan["callEnd"] = null;
  if (call && !call.endedAt) {
    const endedAt = closingTime(call, hardStopAt);
    callEnd = { endedAt, durationSeconds: call.startedAt ? secondsBetween(call.startedAt, endedAt) : null };
  }

  let booking: ClosePlan["booking"] = null;
  if (status === "in_progress" || (status === "confirmed" && paid && call?.startedAt)) booking = "completed";
  else if (status === "confirmed" && paid && call?.doctorJoinedAt && !call.patientJoinedAt) booking = "no_show";
  if (booking && !canTransition(status, booking)) booking = null;

  return { callEnd, booking };
}

// What staff see (/admin/bookings) ----------------------------------------------------------------

export type AttendanceSummary = { text: string; alert: boolean };

/** "24 min", "under a minute", "1 h 5 min". */
export function formatCallDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`;
}

/**
 * One line about a paid consultation's video call, for staff. Null for bookings without online
 * payment (no video) and for cancelled ones. `alert` marks what staff should act on once the call
 * has closed: the doctor didn't join, or the two were never in it at the same time.
 */
export function attendanceSummary(
  booking: { status: BookingStatus; startsAt: Date; endsAt: Date; paid: boolean },
  call: (CallAttendance & { endedBy: "doctor" | "system" | null; durationSeconds: number | null }) | null,
  timeZone: string,
  now: Date,
  config?: ConsultationWindowConfig,
): AttendanceSummary | null {
  if (booking.status === "cancelled" || booking.status === "pending_payment") return null;
  if (!booking.paid && !call) return null;
  const closed = now.getTime() >= consultationWindow(booking, config).hardStopAt.getTime();
  const at = (t: Date) => formatTime(t, timeZone);

  if (call?.startedAt && call.endedAt) {
    const how = call.endedBy === "doctor" ? "ended by the doctor" : "closed automatically";
    return { text: `Video call: ${formatCallDuration(call.durationSeconds ?? secondsBetween(call.startedAt, call.endedAt))}, ${how}`, alert: false };
  }
  if (call?.startedAt) return { text: `Video call in progress since ${at(call.startedAt)}`, alert: false };

  const doctor = call?.doctorJoinedAt ? `Doctor joined ${at(call.doctorJoinedAt)}` : "Doctor not joined";
  const patient = call?.patientJoinedAt ? `patient joined ${at(call.patientJoinedAt)}` : "patient not joined";
  if (!closed) return call?.doctorJoinedAt || call?.patientJoinedAt ? { text: `${doctor} · ${patient}`, alert: false } : null;

  if (!call?.doctorJoinedAt) {
    return { text: `The doctor didn’t join the video call (${patient}). Cancelling the booking flags the payment for a refund.`, alert: true };
  }
  if (!call.patientJoinedAt) return { text: "The patient didn’t join the video call.", alert: false };
  return { text: `${doctor} · ${patient}, but never at the same time. Check with the doctor.`, alert: true };
}
