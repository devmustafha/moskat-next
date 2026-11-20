import type { BookingStatus } from "@/lib/db/schema";

/**
 * Allowed booking status changes. Every status update goes through `canTransition`.
 *
 *   confirmed → cancelled   patient (online, until the cut-off) or hospital (any time)
 *   confirmed → completed   automatically, 24 h after the appointment ends
 *   confirmed → no_show     staff
 *   completed → no_show     staff correction
 *
 * `cancelled` and `no_show` are final. Bookings start as `confirmed` (no payment step yet);
 * add a `pending` status with a migration if payment or staff review is introduced.
 */
const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  confirmed: ["cancelled", "completed", "no_show"],
  completed: ["no_show"],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

/** Statuses that hold a time slot. Must match the exclusion constraint in drizzle/0001_booking_overlap.sql. */
export const slotHoldingStatuses: readonly BookingStatus[] = ["confirmed", "completed", "no_show"];
