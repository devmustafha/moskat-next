import { and, asc, eq, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { consultationBookings, doctors, payments } from "@/lib/db/schema";
import { bookingWasPaid, flagPaymentForRefund } from "@/lib/payments/refunds";
import { siteConfig } from "@/lib/site";
import { canTransition } from "./status";
import { hashToken, isWellFormedToken } from "./tokens";

const HOUR = 60 * 60 * 1000;

export type ManagedBooking = {
  id: string;
  reference: string;
  status: (typeof consultationBookings.$inferSelect)["status"];
  startsAt: Date;
  endsAt: Date;
  feeCents: number;
  currency: string;
  patientName: string | null;
  patientEmail: string | null;
  cancelledAt: Date | null;
  cancelledBy: (typeof consultationBookings.$inferSelect)["cancelledBy"];
  /** While `pending_payment`: when the unpaid hold lapses. */
  paymentExpiresAt: Date | null;
  /** Whether money was taken for this booking (even if it was later cancelled or refunded). */
  paid: boolean;
  doctor: { slug: string; name: string; specialty: string; timeZone: string };
};

/** Columns a patient may see about their own booking. Shared by the manage link and the account area. */
const managedBookingFields = {
  id: consultationBookings.id,
  reference: consultationBookings.reference,
  status: consultationBookings.status,
  startsAt: consultationBookings.startsAt,
  endsAt: consultationBookings.endsAt,
  feeCents: consultationBookings.feeCents,
  currency: consultationBookings.currency,
  patientName: consultationBookings.patientName,
  patientEmail: consultationBookings.patientEmail,
  cancelledAt: consultationBookings.cancelledAt,
  cancelledBy: consultationBookings.cancelledBy,
  paymentExpiresAt: consultationBookings.paymentExpiresAt,
  paid: bookingWasPaid(consultationBookings.id),
  doctor: { slug: doctors.slug, name: doctors.name, specialty: doctors.specialty, timeZone: doctors.timeZone },
};

/** Bookings joined to their doctor, selecting only `managedBookingFields`. Add a `where`. */
export function selectManagedBookings(db: Db) {
  return db
    .select(managedBookingFields)
    .from(consultationBookings)
    .innerJoin(doctors, eq(consultationBookings.doctorId, doctors.id));
}

/** The booking behind a private manage link, or null for unknown or malformed tokens. */
export async function findBookingByToken(db: Db, token: string): Promise<ManagedBooking | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await selectManagedBookings(db)
    .where(eq(consultationBookings.manageTokenHash, await hashToken(token)))
    .limit(1);
  return row ?? null;
}

/** Whether the patient can still cancel online (unpaid or confirmed, and before the cut-off). */
export function canPatientCancel(booking: Pick<ManagedBooking, "status" | "startsAt">, now = new Date()) {
  const cutoff = booking.startsAt.getTime() - siteConfig.booking.cancelUntilHours * HOUR;
  return canTransition(booking.status, "cancelled") && now.getTime() < cutoff;
}

export type CancelResult =
  /**
   * `refundDue`: the booking had been paid; its payment is now flagged for a refund.
   * `previousStatus`: what it was before (an unpaid hold the patient abandons needs no email).
   */
  | { ok: true; booking: ManagedBooking; refundDue: boolean; previousStatus: ManagedBooking["status"] }
  | { ok: false; reason: "not_found" | "not_cancellable" };

/** Cancel through the manage link. Frees the slot immediately. */
export async function cancelBookingByToken(db: Db, token: string, now = new Date()): Promise<CancelResult> {
  const booking = await findBookingByToken(db, token);
  return cancelAsPatient(db, booking, now);
}

/**
 * Cancel a booking and, if it was paid, flag the payment for a refund, in one transaction.
 * Only if the status is still `from`, so a concurrent change isn't overwritten. `condition` adds
 * to the UPDATE (e.g. ownership). Returns null if nothing was cancelled.
 *
 * Locks the booking's payments first, then the booking: the same order as settlePayment
 * (lib/payments/settle.ts), so a cancel racing a payment can't deadlock.
 */
export async function cancelBooking(
  db: Db,
  bookingId: string,
  from: ManagedBooking["status"],
  set: { cancelledAt: Date; cancelledBy: "patient" | "hospital" },
  condition?: SQL,
): Promise<{ refundDue: boolean } | null> {
  if (!canTransition(from, "cancelled")) return null;
  return db.transaction(async (tx) => {
    await tx.select({ id: payments.id }).from(payments).where(eq(payments.bookingId, bookingId)).orderBy(asc(payments.id)).for("update");
    const updated = await tx
      .update(consultationBookings)
      .set({ status: "cancelled", ...set })
      .where(and(eq(consultationBookings.id, bookingId), eq(consultationBookings.status, from), condition))
      .returning({ id: consultationBookings.id });
    if (updated.length === 0) return null;
    return { refundDue: await flagPaymentForRefund(tx, bookingId) };
  });
}

/**
 * Cancel a booking the patient has already been shown to hold (by manage token or account).
 * `owner` adds a condition to the UPDATE itself, so ownership is re-checked in the same statement.
 */
export async function cancelAsPatient(db: Db, booking: ManagedBooking | null, now: Date, owner?: SQL): Promise<CancelResult> {
  if (!booking) return { ok: false, reason: "not_found" };
  if (!canPatientCancel(booking, now)) return { ok: false, reason: "not_cancellable" };

  const cancelled = await cancelBooking(db, booking.id, booking.status, { cancelledAt: now, cancelledBy: "patient" }, owner);
  if (!cancelled) return { ok: false, reason: "not_cancellable" };
  return {
    ok: true,
    booking: { ...booking, status: "cancelled", cancelledAt: now, cancelledBy: "patient" },
    refundDue: cancelled.refundDue,
    previousStatus: booking.status,
  };
}
