import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, ne, or } from "drizzle-orm";
import type { DoctorSession } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings, doctorAvailability, doctors, doctorTimeOff, users } from "@/lib/db/schema";
import { isoDateIn, startOfDayIn } from "@/lib/format";

/**
 * A signed-in doctor's own schedule, bookings and patients. Every query is scoped to
 * `doctor.doctorId`, where `doctor` is the result of `requireDoctor`; no route takes a doctor id,
 * so one doctor can never reach another's data.
 */

/** Most bookings the queue shows. */
const QUEUE_LIMIT = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Statuses that give a doctor access to a patient's page: a booking that happened or is still
 * due. A cancelled booking grants nothing.
 */
const accessGrantingStatuses = ["confirmed", "completed", "no_show"] as const;

/** The active doctor profile linked to a doctor account, or null. Used by `requireDoctor` only. */
export async function findLinkedDoctorId(db: Db, userId: string): Promise<number | null> {
  const [row] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.userId, userId), eq(doctors.isActive, true)))
    .limit(1);
  return row?.id ?? null;
}

export type DoctorProfile = {
  name: string;
  specialty: string;
  slug: string;
  timeZone: string;
  consultationMinutes: number;
  consultationFeeCents: number;
  currency: string;
};

export type DoctorSchedule = {
  profile: DoctorProfile;
  /** Weekly hours that apply today or later, by weekday then start time. */
  hours: { weekday: number; startTime: string; endTime: string; effectiveFrom: string; effectiveUntil: string | null }[];
  /** Time off that hasn't ended yet, soonest first. */
  timeOff: { startsAt: Date; endsAt: Date; note: string | null }[];
};

/** The doctor's profile, weekly hours and upcoming time off (read-only). */
export async function getDoctorSchedule(db: Db, doctor: DoctorSession, now = new Date()): Promise<DoctorSchedule> {
  const [profile] = await db
    .select({
      name: doctors.name,
      specialty: doctors.specialty,
      slug: doctors.slug,
      timeZone: doctors.timeZone,
      consultationMinutes: doctors.consultationMinutes,
      consultationFeeCents: doctors.consultationFeeCents,
      currency: doctors.currency,
    })
    .from(doctors)
    .where(eq(doctors.id, doctor.doctorId))
    .limit(1);
  if (!profile) throw new Error(`Doctor profile ${doctor.doctorId} not found`);

  const today = isoDateIn(now, profile.timeZone);
  const [hours, timeOff] = await Promise.all([
    db
      .select({
        weekday: doctorAvailability.weekday,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        effectiveFrom: doctorAvailability.effectiveFrom,
        effectiveUntil: doctorAvailability.effectiveUntil,
      })
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, doctor.doctorId),
          or(isNull(doctorAvailability.effectiveUntil), gte(doctorAvailability.effectiveUntil, today)),
        ),
      )
      .orderBy(asc(doctorAvailability.weekday), asc(doctorAvailability.startTime), asc(doctorAvailability.effectiveFrom)),
    db
      .select({ startsAt: doctorTimeOff.startsAt, endsAt: doctorTimeOff.endsAt, note: doctorTimeOff.note })
      .from(doctorTimeOff)
      .where(and(eq(doctorTimeOff.doctorId, doctor.doctorId), gt(doctorTimeOff.endsAt, now)))
      .orderBy(asc(doctorTimeOff.startsAt)),
  ]);

  return { profile, hours, timeOff };
}

export type QueueBooking = {
  id: string;
  reference: string;
  status: (typeof bookings.$inferSelect)["status"];
  startsAt: Date;
  endsAt: Date;
  patientName: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  /** Set when the patient booked while signed in, so the doctor can open their page. Null for guests. */
  patientUserId: string | null;
};

/** The doctor's time zone, for showing their queue and patients' bookings. */
async function doctorTimeZone(db: Db, doctor: DoctorSession) {
  const [row] = await db.select({ timeZone: doctors.timeZone }).from(doctors).where(eq(doctors.id, doctor.doctorId)).limit(1);
  if (!row) throw new Error(`Doctor profile ${doctor.doctorId} not found`);
  return row.timeZone;
}

const queueFields = {
  id: bookings.id,
  reference: bookings.reference,
  status: bookings.status,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  patientName: bookings.patientName,
  patientEmail: bookings.patientEmail,
  patientPhone: bookings.patientPhone,
  patientUserId: bookings.patientUserId,
};

/** Today's and upcoming consultations (not cancelled), earliest first, with the doctor's time zone. */
export async function listDoctorQueue(db: Db, doctor: DoctorSession, now = new Date()) {
  const timeZone = await doctorTimeZone(db, doctor);
  const rows: QueueBooking[] = await db
    .select(queueFields)
    .from(bookings)
    .where(and(eq(bookings.doctorId, doctor.doctorId), gte(bookings.startsAt, startOfDayIn(now, timeZone)), ne(bookings.status, "cancelled")))
    .orderBy(asc(bookings.startsAt))
    .limit(QUEUE_LIMIT);
  return { timeZone, bookings: rows };
}

/**
 * Whether the doctor has (or had) a consultation with this patient: a booking with this doctor,
 * linked to the patient's account, that wasn't cancelled. Malformed ids are simply false.
 */
export async function assertDoctorHasPatient(db: Db, doctor: DoctorSession, patientId: string): Promise<boolean> {
  if (!UUID.test(patientId)) return false;
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.doctorId, doctor.doctorId),
        eq(bookings.patientUserId, patientId),
        inArray(bookings.status, [...accessGrantingStatuses]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type DoctorPatient = {
  name: string;
  email: string;
  timeZone: string;
  /** This doctor's bookings with the patient only, most recent first. */
  bookings: QueueBooking[];
};

/**
 * A patient of this doctor, or null when the doctor has no access (no non-cancelled booking with
 * them), which pages show as a 404 so they don't reveal whether the patient exists.
 */
export async function getDoctorPatient(db: Db, doctor: DoctorSession, patientId: string): Promise<DoctorPatient | null> {
  if (!(await assertDoctorHasPatient(db, doctor, patientId))) return null;

  const [[patient], timeZone, rows] = await Promise.all([
    db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, patientId), eq(users.role, "patient")))
      .limit(1),
    doctorTimeZone(db, doctor),
    db
      .select(queueFields)
      .from(bookings)
      .where(and(eq(bookings.doctorId, doctor.doctorId), eq(bookings.patientUserId, patientId)))
      .orderBy(desc(bookings.startsAt))
      .limit(QUEUE_LIMIT),
  ]);
  if (!patient) return null;
  return { ...patient, timeZone, bookings: rows };
}
