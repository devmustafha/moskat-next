import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { ConsultationActor } from "@/lib/auth/session";
import { canTransition } from "@/lib/booking/status";
import type { Db } from "@/lib/db/client";
import { type BookingStatus, consultationBookings as bookings, consultationCalls as calls, doctors } from "@/lib/db/schema";
import { bookingIsPaid } from "@/lib/payments/refunds";
import type { ConsultationRole } from "./access";
import type { CallStatus } from "./call-ui";
import { createChannelName } from "./channel";
import { type AttendanceEvent, type CallAttendance, decideEnd } from "./lifecycle";

/**
 * Video consultations, as seen by one of their two participants. Every lookup is scoped to the
 * actor from `getConsultationActorOn` (the patient's own account, or the doctor's own profile),
 * never to an id from the request alone, so anyone else's booking is simply not found.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConsultationCallRow = CallAttendance & {
  channelName: string;
  endedBy: "doctor" | "system" | null;
  durationSeconds: number | null;
};

export type Consultation = {
  bookingId: string;
  role: ConsultationRole;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  /** A succeeded payment exists (refunds and reviews don't count). */
  paid: boolean;
  doctorName: string;
  /** The doctor's time zone, for showing the call's times. */
  timeZone: string;
  /** The patient's name as booked; null once purged. */
  patientName: string | null;
  call: ConsultationCallRow | null;
};

/** The call columns, for selecting next to a booking. */
export const callFields = {
  channelName: calls.channelName,
  doctorJoinedAt: calls.doctorJoinedAt,
  patientJoinedAt: calls.patientJoinedAt,
  doctorLeftAt: calls.doctorLeftAt,
  patientLeftAt: calls.patientLeftAt,
  startedAt: calls.startedAt,
  endedAt: calls.endedAt,
  endedBy: calls.endedBy,
  durationSeconds: calls.durationSeconds,
};

/** The actor's own consultation with this booking id, or null (not theirs, or doesn't exist). */
export async function findConsultation(db: Db, actor: ConsultationActor, bookingId: string): Promise<Consultation | null> {
  if (!UUID.test(bookingId)) return null;
  const owner = actor.role === "patient" ? eq(bookings.patientUserId, actor.id) : eq(bookings.doctorId, actor.doctorId);

  const [row] = await db
    .select({
      bookingId: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      paid: bookingIsPaid(bookings.id),
      doctorName: doctors.name,
      timeZone: doctors.timeZone,
      patientName: bookings.patientName,
      call: callFields,
    })
    .from(bookings)
    .innerJoin(doctors, eq(bookings.doctorId, doctors.id))
    .leftJoin(calls, eq(calls.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), owner))
    .limit(1);
  if (!row) return null;

  // Drizzle returns a left-joined object with every field null when there's no call row.
  const call = row.call?.channelName ? (row.call as ConsultationCallRow) : null;
  return { ...row, role: actor.role, call };
}

/**
 * The booking's call, created on first use with a fresh random channel name. Safe to call
 * concurrently (`on conflict do nothing`). Getting a token doesn't count as joining: the call
 * screen reports that once Agora has let the participant in (recordAttendance).
 */
export async function openCallFor(db: Db, consultation: Consultation): Promise<{ channelName: string }> {
  if (consultation.call) return { channelName: consultation.call.channelName };
  await db.insert(calls).values({ bookingId: consultation.bookingId, channelName: createChannelName() }).onConflictDoNothing({ target: calls.bookingId });
  const [call] = await db.select({ channelName: calls.channelName }).from(calls).where(eq(calls.bookingId, consultation.bookingId));
  return call;
}

/**
 * Record that this participant joined or left the call (no-op once it has ended). Joining clears
 * their left time, so a rejoin counts as present again. When the second person joins while the
 * first is present, the call has started and a confirmed booking moves to `in_progress`.
 *
 * One UPDATE per event: concurrent joins from both sides are serialised on the call row, so
 * `started_at` is set exactly once.
 */
export async function recordAttendance(db: Db, consultation: Consultation, event: AttendanceEvent, now: Date): Promise<{ recorded: boolean; started: boolean }> {
  const doctor = consultation.role === "doctor";
  const [mineJoined, mineLeft] = doctor ? [calls.doctorJoinedAt, calls.doctorLeftAt] : [calls.patientJoinedAt, calls.patientLeftAt];
  const [otherJoined, otherLeft] = doctor ? [calls.patientJoinedAt, calls.patientLeftAt] : [calls.doctorJoinedAt, calls.doctorLeftAt];

  let set: PgUpdateSetSource<typeof calls>;
  if (event === "joined") {
    const startedAt = sql`case when ${calls.startedAt} is null and ${otherJoined} is not null and ${otherLeft} is null then ${now}::timestamptz else ${calls.startedAt} end`;
    set = doctor
      ? { doctorJoinedAt: sql`coalesce(${mineJoined}, ${now}::timestamptz)`, doctorLeftAt: null, startedAt }
      : { patientJoinedAt: sql`coalesce(${mineJoined}, ${now}::timestamptz)`, patientLeftAt: null, startedAt };
  } else {
    set = doctor ? { doctorLeftAt: now } : { patientLeftAt: now };
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(calls)
      .set(set)
      .where(and(eq(calls.bookingId, consultation.bookingId), isNull(calls.endedAt), event === "left" ? isNotNull(mineJoined) : undefined))
      .returning({ startedAt: calls.startedAt });
    if (!row) return { recorded: false, started: false };

    if (row.startedAt && canTransition(consultation.status, "in_progress")) {
      await tx
        .update(bookings)
        .set({ status: "in_progress" })
        .where(and(eq(bookings.id, consultation.bookingId), eq(bookings.status, "confirmed")));
    }
    return { recorded: true, started: row.startedAt !== null };
  });
}

export type EndResult =
  | { ok: true; status: BookingStatus; endedAt: Date; durationSeconds: number | null }
  | { ok: false; reason: "doctor_only" | "not_active" | "not_started" };

/**
 * The doctor's "End for both": closes the call, records its duration and completes the booking,
 * in one transaction with both rows locked. Asking again after it ended returns what was recorded.
 * The patient's call screen notices through the status endpoint, and no further token is issued.
 */
export async function endConsultation(db: Db, consultation: Consultation, now: Date): Promise<EndResult> {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, consultation.bookingId)).for("update");
    const [call] = await tx.select(callFields).from(calls).where(eq(calls.bookingId, consultation.bookingId)).for("update");
    if (!booking) return { ok: false, reason: "not_active" };

    const decision = decideEnd({ role: consultation.role, status: booking.status, call: call ?? null, now });
    if (!decision.ok) {
      if (decision.reason === "already_ended" && call?.endedAt) return { ok: true, status: booking.status, endedAt: call.endedAt, durationSeconds: call.durationSeconds };
      return { ok: false, reason: decision.reason === "already_ended" ? "not_active" : decision.reason };
    }

    await tx
      .update(calls)
      .set({
        endedAt: now,
        endedBy: "doctor",
        durationSeconds: decision.durationSeconds,
        doctorLeftAt: now,
        patientLeftAt: sql`coalesce(${calls.patientLeftAt}, ${now}::timestamptz)`,
      })
      .where(eq(calls.bookingId, consultation.bookingId));
    await tx
      .update(bookings)
      .set({ status: "completed" })
      .where(and(eq(bookings.id, consultation.bookingId), eq(bookings.status, booking.status)));
    return { ok: true, status: "completed", endedAt: now, durationSeconds: decision.durationSeconds };
  });
}

/** What the call screen polls for: has the call started (both in it), and has it ended? */
export function callStatusOf(consultation: Consultation): CallStatus {
  const { status, call } = consultation;
  const ended = Boolean(call?.endedAt) || status === "completed" || status === "no_show" || status === "cancelled";
  return { status, started: Boolean(call?.startedAt), ended, endedBy: call?.endedBy ?? (ended ? "system" : null) };
}
