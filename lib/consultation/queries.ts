import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { ConsultationActor } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings, consultationCalls as calls, doctors, payments } from "@/lib/db/schema";
import type { ConsultationRole } from "./access";
import { createChannelName } from "./channel";

/**
 * Video consultations, as seen by one of their two participants. Every lookup is scoped to the
 * actor from `getConsultationActorOn` (the patient's own account, or the doctor's own profile),
 * never to an id from the request alone, so anyone else's booking is simply not found.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Consultation = {
  bookingId: string;
  role: ConsultationRole;
  status: (typeof bookings.$inferSelect)["status"];
  startsAt: Date;
  endsAt: Date;
  /** A succeeded payment exists (refunds and reviews don't count). */
  paid: boolean;
  doctorName: string;
  /** The patient's name as booked; null once purged. */
  patientName: string | null;
  call: { channelName: string; endedAt: Date | null; doctorJoinedAt: Date | null; patientJoinedAt: Date | null } | null;
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
      paid: sql<boolean>`exists (select 1 from ${payments} where ${payments.bookingId} = ${bookings.id} and ${payments.status} = 'succeeded')`,
      doctorName: doctors.name,
      patientName: bookings.patientName,
      channelName: calls.channelName,
      endedAt: calls.endedAt,
      doctorJoinedAt: calls.doctorJoinedAt,
      patientJoinedAt: calls.patientJoinedAt,
    })
    .from(bookings)
    .innerJoin(doctors, eq(bookings.doctorId, doctors.id))
    .leftJoin(calls, eq(calls.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), owner))
    .limit(1);
  if (!row) return null;

  const { channelName, endedAt, doctorJoinedAt, patientJoinedAt, ...booking } = row;
  return {
    ...booking,
    role: actor.role,
    call: channelName ? { channelName, endedAt, doctorJoinedAt, patientJoinedAt } : null,
  };
}

/**
 * The booking's call, created on first use with a fresh random channel name, with this
 * participant's first join recorded (first token issued). Safe to call concurrently: the insert
 * is `on conflict do nothing` and the join time is only set once.
 */
export async function openCallFor(db: Db, consultation: Consultation, now: Date): Promise<{ channelName: string }> {
  await db.insert(calls).values({ bookingId: consultation.bookingId, channelName: createChannelName() }).onConflictDoNothing({ target: calls.bookingId });
  const joined = consultation.role === "doctor" ? calls.doctorJoinedAt : calls.patientJoinedAt;
  const [call] = await db
    .update(calls)
    .set(consultation.role === "doctor" ? { doctorJoinedAt: sql`coalesce(${joined}, ${now})` } : { patientJoinedAt: sql`coalesce(${joined}, ${now})` })
    .where(eq(calls.bookingId, consultation.bookingId))
    .returning({ channelName: calls.channelName });
  return call;
}
