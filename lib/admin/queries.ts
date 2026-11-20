import "server-only";
import { and, asc, desc, eq, exists, gt, isNull, lte, sql } from "drizzle-orm";
import type { AdminSession } from "@/lib/auth/session";
import { cancelBooking } from "@/lib/booking/manage";
import { canTransition } from "@/lib/booking/status";
import type { Db } from "@/lib/db/client";
import {
  consultationBookings as bookings,
  type BookingStatus,
  departments,
  doctors,
  type PaymentReviewReason,
  payments,
  type PaymentStatus,
  users,
} from "@/lib/db/schema";

/**
 * The hospital admin area. Every function takes the result of `requireAdmin`, so it can only be
 * called on behalf of a signed-in admin. Admins manage the catalogue and bookings; booking queries
 * select explicit columns (schedule, status, fee, patient contact) and nothing else, and no
 * function here reads doctor or patient account areas.
 */

const LIST_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Doctors ------------------------------------------------------------------------------------

export type AdminDoctor = {
  id: number;
  slug: string;
  name: string;
  specialty: string;
  department: string;
  isActive: boolean;
  consultationFeeCents: number;
  currency: string;
  consultationMinutes: number;
  /** The linked sign-in account, if any. */
  account: { id: string; email: string; banned: boolean } | null;
};

export async function listAdminDoctors(db: Db, _admin: AdminSession): Promise<AdminDoctor[]> {
  const rows = await db
    .select({
      id: doctors.id,
      slug: doctors.slug,
      name: doctors.name,
      specialty: doctors.specialty,
      department: departments.name,
      isActive: doctors.isActive,
      consultationFeeCents: doctors.consultationFeeCents,
      currency: doctors.currency,
      consultationMinutes: doctors.consultationMinutes,
      accountId: users.id,
      accountEmail: users.email,
      accountBanned: users.banned,
    })
    .from(doctors)
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .leftJoin(users, eq(doctors.userId, users.id))
    .orderBy(asc(doctors.sortOrder), asc(doctors.name));

  return rows.map(({ accountId, accountEmail, accountBanned, ...doctor }) => ({
    ...doctor,
    account: accountId && accountEmail ? { id: accountId, email: accountEmail, banned: accountBanned ?? false } : null,
  }));
}

/** The doctor profile with this id, if it has no account linked yet. */
export async function findUnlinkedDoctor(db: Db, _admin: AdminSession, doctorId: number) {
  const [row] = await db
    .select({ id: doctors.id, name: doctors.name })
    .from(doctors)
    .where(and(eq(doctors.id, doctorId), isNull(doctors.userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Link a doctor account to a profile. Only links an unlinked profile, and only to an account
 * whose role is `doctor` (checked in the same statement). Returns false if nothing was linked.
 */
export async function linkDoctorAccount(db: Db, _admin: AdminSession, doctorId: number, userId: string): Promise<boolean> {
  if (!UUID.test(userId)) return false;
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

/** The doctor account linked to a profile, for ban and unban. */
export async function findLinkedAccount(db: Db, _admin: AdminSession, doctorId: number) {
  const [row] = await db
    .select({ userId: users.id })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.id, doctorId))
    .limit(1);
  return row?.userId ?? null;
}

// Pricing ------------------------------------------------------------------------------------

/** Change a doctor's online consultation fee (cents) and length. New bookings use them; existing ones keep theirs. */
export async function updateDoctorPricing(
  db: Db,
  _admin: AdminSession,
  doctorId: number,
  values: { consultationFeeCents: number; consultationMinutes: number },
): Promise<boolean> {
  const updated = await db.update(doctors).set(values).where(eq(doctors.id, doctorId)).returning({ id: doctors.id });
  return updated.length === 1;
}

// Departments --------------------------------------------------------------------------------

export type AdminDepartment = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  intro: string;
  location: string;
  sortOrder: number;
  isActive: boolean;
};

export function listAdminDepartments(db: Db, _admin: AdminSession): Promise<AdminDepartment[]> {
  return db
    .select({
      id: departments.id,
      slug: departments.slug,
      name: departments.name,
      summary: departments.summary,
      intro: departments.intro,
      location: departments.location,
      sortOrder: departments.sortOrder,
      isActive: departments.isActive,
    })
    .from(departments)
    .orderBy(asc(departments.sortOrder), asc(departments.name));
}

export async function updateDepartment(
  db: Db,
  _admin: AdminSession,
  id: number,
  values: Omit<AdminDepartment, "id" | "slug">,
): Promise<boolean> {
  const updated = await db.update(departments).set(values).where(eq(departments.id, id)).returning({ id: departments.id });
  return updated.length === 1;
}

// Bookings -----------------------------------------------------------------------------------

export type AdminBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  feeCents: number;
  currency: string;
  cancelledBy: "patient" | "hospital" | "system" | null;
  patientName: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  doctor: { name: string; specialty: string; timeZone: string };
  /**
   * The payment that matters most for this booking, or null if none was started (bookings made
   * before payments existed). Refunds due come first, then the successful payment, then refunded,
   * then the latest unpaid attempt.
   */
  payment: { status: PaymentStatus; reviewReason: PaymentReviewReason | null; reference: string } | null;
};

/** Order of importance when a booking has several payment attempts. */
const paymentRank = sql`case ${payments.status} when 'needs_review' then 0 when 'succeeded' then 1 when 'refunded' then 2 else 3 end`;

/** Explicit columns only: schedule, status, fee, patient contact and payment state. */
const adminBookingFields = {
  id: bookings.id,
  reference: bookings.reference,
  status: bookings.status,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  feeCents: bookings.feeCents,
  currency: bookings.currency,
  cancelledBy: bookings.cancelledBy,
  patientName: bookings.patientName,
  patientEmail: bookings.patientEmail,
  patientPhone: bookings.patientPhone,
  doctor: { name: doctors.name, specialty: doctors.specialty, timeZone: doctors.timeZone },
  payment: sql<AdminBooking["payment"]>`(
    select json_build_object('status', ${payments.status}, 'reviewReason', ${payments.reviewReason}, 'reference', ${payments.reference})
    from ${payments} where ${payments.bookingId} = ${bookings.id}
    order by ${paymentRank}, ${payments.createdAt} desc limit 1)`,
};

export type BookingView = "upcoming" | "past";

/** Upcoming bookings (not ended yet, soonest first) or past ones (most recent first), all statuses. */
export function listAdminBookings(db: Db, _admin: AdminSession, view: BookingView, now = new Date()): Promise<AdminBooking[]> {
  const query = db.select(adminBookingFields).from(bookings).innerJoin(doctors, eq(bookings.doctorId, doctors.id));
  return view === "upcoming"
    ? query.where(gt(bookings.endsAt, now)).orderBy(asc(bookings.startsAt)).limit(LIST_LIMIT)
    : query.where(lte(bookings.endsAt, now)).orderBy(desc(bookings.startsAt)).limit(LIST_LIMIT);
}

async function findAdminBooking(db: Db, id: string): Promise<AdminBooking | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select(adminBookingFields)
    .from(bookings)
    .innerJoin(doctors, eq(bookings.doctorId, doctors.id))
    .where(eq(bookings.id, id))
    .limit(1);
  return row ?? null;
}

/** The actions an admin can take on a booking right now. */
export function adminActionsFor(booking: Pick<AdminBooking, "status" | "startsAt">, now = new Date()) {
  return {
    cancel: canTransition(booking.status, "cancelled"),
    // Only once the appointment has started: nobody can miss one that hasn't begun.
    noShow: canTransition(booking.status, "no_show") && booking.startsAt.getTime() <= now.getTime(),
  };
}

export type AdminBookingResult =
  /** `refundDue`: a cancelled booking had been paid; its payment is now flagged for a refund. */
  | { ok: true; booking: AdminBooking; refundDue: boolean }
  | { ok: false; reason: "not_found" | "not_allowed" };

/**
 * Cancel on the hospital's behalf (any time while unpaid or confirmed). Frees the slot
 * immediately; a paid booking's payment is flagged for a refund in the same transaction.
 */
export async function cancelBookingAsHospital(db: Db, _admin: AdminSession, id: string, now = new Date()): Promise<AdminBookingResult> {
  const booking = await findAdminBooking(db, id);
  if (!booking) return { ok: false, reason: "not_found" };
  if (!adminActionsFor(booking, now).cancel) return { ok: false, reason: "not_allowed" };

  const cancelled = await cancelBooking(db, booking.id, booking.status, { cancelledAt: now, cancelledBy: "hospital" });
  if (!cancelled) return { ok: false, reason: "not_allowed" };
  return { ok: true, booking: { ...booking, status: "cancelled", cancelledBy: "hospital" }, refundDue: cancelled.refundDue };
}

/** Record that the patient didn't attend (from the start time on). */
export async function markBookingNoShow(db: Db, _admin: AdminSession, id: string, now = new Date()): Promise<AdminBookingResult> {
  const booking = await findAdminBooking(db, id);
  if (!booking) return { ok: false, reason: "not_found" };
  if (!adminActionsFor(booking, now).noShow) return { ok: false, reason: "not_allowed" };

  // Only if the status hasn't changed since it was read, so a concurrent change isn't overwritten.
  const updated = await db
    .update(bookings)
    .set({ status: "no_show" })
    .where(and(eq(bookings.id, booking.id), eq(bookings.status, booking.status)))
    .returning({ id: bookings.id });
  if (updated.length === 0) return { ok: false, reason: "not_allowed" };
  return { ok: true, booking: { ...booking, status: "no_show" }, refundDue: false };
}

/**
 * Record that staff refunded a booking's payment in the Paystack dashboard: every payment of
 * the booking that is flagged for review becomes `refunded`. Returns the booking reference.
 */
export async function markPaymentRefunded(db: Db, _admin: AdminSession, bookingId: string): Promise<{ ok: true; reference: string } | { ok: false }> {
  const booking = await findAdminBooking(db, bookingId);
  if (!booking) return { ok: false };
  const updated = await db
    .update(payments)
    .set({ status: "refunded" })
    .where(and(eq(payments.bookingId, booking.id), eq(payments.status, "needs_review")))
    .returning({ id: payments.id });
  return updated.length > 0 ? { ok: true, reference: booking.reference } : { ok: false };
}
