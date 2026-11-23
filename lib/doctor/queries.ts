import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, notInArray, or } from "drizzle-orm";
import type { DoctorSession } from "@/lib/auth/session";
import { fitsWeeklyHours } from "@/lib/booking/slots";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings, doctorAvailability, doctors, doctorTimeOff, users } from "@/lib/db/schema";
import { type HoursWindow, planHoursReplacement, toHHMM } from "@/lib/doctor/hours";
import type { DoctorProfileInput } from "@/lib/doctor/profile";
import { isoDateIn, startOfDayIn } from "@/lib/format";
import { bookingIsPaid } from "@/lib/payments/refunds";

/**
 * A signed-in doctor's own schedule, bookings, patients, profile and rates. Every query is scoped
 * to `doctor.doctorId`, where `doctor` is the result of `requireDoctor` (pages) or
 * `getDoctorSessionOn` (actions); no route or form takes a doctor id, so one doctor can never
 * reach or change another's data.
 */

/** Most bookings the queue shows. */
const QUEUE_LIMIT = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Statuses that give a doctor access to a patient's page: a booking that happened or is still
 * due. A cancelled booking grants nothing.
 */
const accessGrantingStatuses = ["confirmed", "in_progress", "completed", "no_show"] as const;

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

/** The doctor's profile, weekly hours and upcoming time off, for the schedule overview. */
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
  /** A succeeded payment exists, so the booking has a video call (bookings from before payments don't). */
  paid: boolean;
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
  paid: bookingIsPaid(bookings.id),
};

/**
 * Today's and upcoming consultations, earliest first, with the doctor's time zone. Cancelled
 * bookings and unpaid holds (`pending_payment`, not booked until paid) aren't shown.
 */
export async function listDoctorQueue(db: Db, doctor: DoctorSession, now = new Date()) {
  const timeZone = await doctorTimeZone(db, doctor);
  const rows: QueueBooking[] = await db
    .select(queueFields)
    .from(bookings)
    .where(
      and(
        eq(bookings.doctorId, doctor.doctorId),
        gte(bookings.startsAt, startOfDayIn(now, timeZone)),
        notInArray(bookings.status, ["cancelled", "pending_payment"]),
      ),
    )
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

// Editing their own profile, rates and weekly hours ------------------------------------------

export type DoctorEditable = {
  name: string;
  slug: string;
  specialty: string;
  bio: string[];
  qualifications: string[];
  languages: string[];
  interests: string[];
  yearsExperience: number;
  consultationFeeCents: number;
  currency: string;
  consultationMinutes: number;
  timeZone: string;
  /** Weekly hours in effect today, by weekday then start time ("HH:MM"). */
  hours: HoursWindow[];
  /** Whether hours are scheduled to start after today (saving replaces them). */
  hasScheduledHours: boolean;
};

/** The doctor's editable profile, rates and the weekly hours in effect today. */
export async function getDoctorEditable(db: Db, doctor: DoctorSession, now = new Date()): Promise<DoctorEditable> {
  const [profile] = await db
    .select({
      name: doctors.name,
      slug: doctors.slug,
      specialty: doctors.specialty,
      bio: doctors.bio,
      qualifications: doctors.qualifications,
      languages: doctors.languages,
      interests: doctors.interests,
      yearsExperience: doctors.yearsExperience,
      consultationFeeCents: doctors.consultationFeeCents,
      currency: doctors.currency,
      consultationMinutes: doctors.consultationMinutes,
      timeZone: doctors.timeZone,
    })
    .from(doctors)
    .where(eq(doctors.id, doctor.doctorId))
    .limit(1);
  if (!profile) throw new Error(`Doctor profile ${doctor.doctorId} not found`);

  const today = isoDateIn(now, profile.timeZone);
  const rules = await db
    .select({
      weekday: doctorAvailability.weekday,
      startTime: doctorAvailability.startTime,
      endTime: doctorAvailability.endTime,
      effectiveFrom: doctorAvailability.effectiveFrom,
    })
    .from(doctorAvailability)
    .where(
      and(
        eq(doctorAvailability.doctorId, doctor.doctorId),
        or(isNull(doctorAvailability.effectiveUntil), gte(doctorAvailability.effectiveUntil, today)),
      ),
    )
    .orderBy(asc(doctorAvailability.weekday), asc(doctorAvailability.startTime));

  return {
    ...profile,
    hours: rules
      .filter((rule) => rule.effectiveFrom <= today)
      .map((rule) => ({ weekday: rule.weekday, startTime: toHHMM(rule.startTime), endTime: toHHMM(rule.endTime) })),
    hasScheduledHours: rules.some((rule) => rule.effectiveFrom > today),
  };
}

/** Change the doctor's descriptive profile. Name, specialty, department and photo stay with the hospital. */
export async function updateDoctorProfile(db: Db, doctor: DoctorSession, values: DoctorProfileInput): Promise<boolean> {
  const updated = await db.update(doctors).set(values).where(eq(doctors.id, doctor.doctorId)).returning({ id: doctors.id });
  return updated.length === 1;
}

/** Change the doctor's fee (cents). Existing bookings keep the fee they copied. */
export async function updateDoctorRates(
  db: Db,
  doctor: DoctorSession,
  values: { consultationFeeCents: number },
): Promise<boolean> {
  const updated = await db.update(doctors).set(values).where(eq(doctors.id, doctor.doctorId)).returning({ id: doctors.id });
  return updated.length === 1;
}

/** The doctor's current consultation length, to check that new hours fit at least one consultation. */
export async function getConsultationMinutes(db: Db, doctor: DoctorSession): Promise<number> {
  const [row] = await db
    .select({ minutes: doctors.consultationMinutes })
    .from(doctors)
    .where(eq(doctors.id, doctor.doctorId))
    .limit(1);
  if (!row) throw new Error(`Doctor profile ${doctor.doctorId} not found`);
  return row.minutes;
}

/** Upcoming bookings a change of hours could leave uncovered; more than this is not realistic. */
const UPCOMING_LIMIT = 500;

export type ReplaceHoursResult = {
  changed: boolean;
  timeZone: string;
  /** Upcoming confirmed bookings outside the new hours. They stay booked. */
  outside: { reference: string; startsAt: Date }[];
};

/**
 * Replace the doctor's weekly hours with `windows`, from today in their time zone: past rules get
 * an end date (kept as history), rules that never took effect are deleted, and the new ones start
 * today. Existing bookings are never touched; the ones the new hours don't cover are returned so
 * the doctor can be told. The doctor row is locked so two saves can't interleave.
 */
export async function replaceWeeklyHours(db: Db, doctor: DoctorSession, windows: HoursWindow[], now = new Date()): Promise<ReplaceHoursResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ timeZone: doctors.timeZone })
      .from(doctors)
      .where(eq(doctors.id, doctor.doctorId))
      .for("update")
      .limit(1);
    if (!row) throw new Error(`Doctor profile ${doctor.doctorId} not found`);

    const ruleFields = {
      id: doctorAvailability.id,
      weekday: doctorAvailability.weekday,
      startTime: doctorAvailability.startTime,
      endTime: doctorAvailability.endTime,
      effectiveFrom: doctorAvailability.effectiveFrom,
      effectiveUntil: doctorAvailability.effectiveUntil,
    };
    const mine = eq(doctorAvailability.doctorId, doctor.doctorId);
    const existing = await tx.select(ruleFields).from(doctorAvailability).where(mine);

    const plan = planHoursReplacement(existing, windows, isoDateIn(now, row.timeZone));
    if (!plan.changed) return { changed: false, timeZone: row.timeZone, outside: [] };

    for (const { id, effectiveUntil } of plan.end) {
      await tx.update(doctorAvailability).set({ effectiveUntil }).where(and(mine, eq(doctorAvailability.id, id)));
    }
    if (plan.remove.length > 0) {
      await tx.delete(doctorAvailability).where(and(mine, inArray(doctorAvailability.id, plan.remove)));
    }
    if (plan.insert.length > 0) {
      await tx.insert(doctorAvailability).values(plan.insert.map((rule) => ({ ...rule, doctorId: doctor.doctorId })));
    }

    // One after the other: a transaction is a single connection.
    const rules = await tx.select(ruleFields).from(doctorAvailability).where(mine);
    const upcoming = await tx
      .select({ reference: bookings.reference, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
      .from(bookings)
      // Unpaid holds count too: they may still be paid and confirmed.
      .where(and(eq(bookings.doctorId, doctor.doctorId), inArray(bookings.status, ["pending_payment", "confirmed", "in_progress"]), gt(bookings.endsAt, now)))
      .orderBy(asc(bookings.startsAt))
      .limit(UPCOMING_LIMIT);
    const outside = upcoming
      .filter((booking) => !fitsWeeklyHours({ start: booking.startsAt, end: booking.endsAt }, rules, row.timeZone))
      .map(({ reference, startsAt }) => ({ reference, startsAt }));

    return { changed: true, timeZone: row.timeZone, outside };
  });
}
