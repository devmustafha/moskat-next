import type { BookingStatus } from "@/lib/db/schema";

/**
 * Allowed booking status changes. Every status update goes through `canTransition`.
 *
 *   pending_payment → confirmed   Paystack payment verified server-side (lib/payments/settle.ts)
 *   pending_payment → cancelled   patient, hospital, or `system` when the unpaid hold lapses
 *   confirmed → cancelled         patient (online, until the cut-off) or hospital (any time);
 *                                 a paid booking's payment is flagged for refund
 *   confirmed → completed         automatically, 24 h after the appointment ends
 *   confirmed → no_show           staff
 *   completed → no_show           staff correction
 *
 * `cancelled` and `no_show` are final. New bookings start as `pending_payment`; bookings made
 * before payments existed are `confirmed` with no payment row.
 */
const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  completed: ["no_show"],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

/**
 * Statuses that hold a time slot. The exclusion constraint in drizzle/0001_booking_overlap.sql
 * covers every status except `cancelled`, so a new status holds its slot unless it's excluded there too.
 * An unpaid hold stops holding its slot once `payment_expires_at` passes (see `isLiveHold`).
 */
export const slotHoldingStatuses: readonly BookingStatus[] = ["pending_payment", "confirmed", "completed", "no_show"];

/** Whether a booking still holds its slot at `now`: anything not cancelled, except a lapsed unpaid hold. */
export function isLiveHold(booking: { status: BookingStatus; paymentExpiresAt: Date | null }, now: Date) {
  if (booking.status === "cancelled") return false;
  if (booking.status !== "pending_payment") return true;
  return booking.paymentExpiresAt !== null && booking.paymentExpiresAt.getTime() > now.getTime();
}
