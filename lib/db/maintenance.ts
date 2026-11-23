import { and, eq, isNotNull, isNull, lt, lte, ne, not, or } from "drizzle-orm";
import { canTransition } from "@/lib/booking/status";
import { planClose } from "@/lib/consultation/lifecycle";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings, consultationCalls as calls, rateLimits, sessions } from "@/lib/db/schema";
import { bookingIsPaid } from "@/lib/payments/refunds";
import { siteConfig } from "@/lib/site";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Video consultations past their hard stop (end + grace) that are still in progress or have an
 * open call: close the call (by `system`) and complete the booking, or mark it missed when the
 * doctor joined and the patient never did (lib/consultation/lifecycle.ts planClose). A booking
 * the doctor never joined stays as it is, for staff. Each booking is updated in its own
 * transaction, only if its status hasn't changed meanwhile.
 */
async function closeFinishedCalls(db: Db, now: Date) {
  const hardStopPassed = lte(bookings.endsAt, new Date(now.getTime() - siteConfig.consultation.graceMinutesAfterEnd * MINUTE));
  const due = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      endsAt: bookings.endsAt,
      paid: bookingIsPaid(bookings.id),
      callId: calls.bookingId,
      doctorJoinedAt: calls.doctorJoinedAt,
      patientJoinedAt: calls.patientJoinedAt,
      doctorLeftAt: calls.doctorLeftAt,
      patientLeftAt: calls.patientLeftAt,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
    })
    .from(bookings)
    .leftJoin(calls, eq(calls.bookingId, bookings.id))
    .where(and(hardStopPassed, or(eq(bookings.status, "in_progress"), and(isNotNull(calls.bookingId), isNull(calls.endedAt)))))
    .limit(500);

  let callsClosed = 0;
  let completed = 0;
  let missed = 0;
  for (const { id, status, endsAt, paid, callId, ...call } of due) {
    const plan = planClose({ status, paid, call: callId ? call : null, endsAt, now });
    if (!plan) continue;
    await db.transaction(async (tx) => {
      if (plan.callEnd) {
        const closed = await tx
          .update(calls)
          .set({ endedAt: plan.callEnd.endedAt, endedBy: "system", durationSeconds: plan.callEnd.durationSeconds })
          .where(and(eq(calls.bookingId, id), isNull(calls.endedAt)))
          .returning({ id: calls.bookingId });
        callsClosed += closed.length;
      }
      if (plan.booking && canTransition(status, plan.booking)) {
        const moved = await tx
          .update(bookings)
          .set({ status: plan.booking })
          .where(and(eq(bookings.id, id), eq(bookings.status, status)))
          .returning({ id: bookings.id });
        if (plan.booking === "completed") completed += moved.length;
        else missed += moved.length;
      }
    });
  }
  return { callsClosed, completed, missed };
}

/**
 * Daily housekeeping (cron trigger, or `npm run db:maintenance`):
 * 1. Unpaid holds whose payment window has passed are cancelled by `system`. (Booking releases
 *    overlapping ones straight away; this catches the rest.) A payment that still arrives later is
 *    flagged for refund by settlePayment.
 * 2. Video calls past their hard stop are closed (closeFinishedCalls): started calls complete
 *    the booking, a call the patient never joined marks it missed (`no_show`), and one the
 *    doctor never joined is left for staff.
 *    Confirmed bookings without online payment (made before payments, so no video) that ended
 *    over 24 hours ago become `completed` (staff can still correct one to `no_show`).
 * 3. Patient name, email and phone are cleared once a booking is past the retention period,
 *    counted from the appointment end, or from the cancellation for cancelled bookings.
 *    The anonymous row stays for scheduling history.
 * 4. Sign-in sessions that expired over a day ago are deleted (they hold IP address and browser),
 *    as are sign-in rate-limit counters older than a day (keyed by IP address).
 */
export async function runMaintenance(db: Db, now: Date) {
  const expiredHolds = await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: now, cancelledBy: "system" })
    .where(and(eq(bookings.status, "pending_payment"), or(isNull(bookings.paymentExpiresAt), lte(bookings.paymentExpiresAt, now))))
    .returning({ id: bookings.id });

  const closed = await closeFinishedCalls(db, now);

  const completed = await db
    .update(bookings)
    .set({ status: "completed" })
    .where(and(eq(bookings.status, "confirmed"), lt(bookings.endsAt, new Date(now.getTime() - DAY)), not(bookingIsPaid(bookings.id))))
    .returning({ id: bookings.id });

  const cutoff = new Date(now.getTime() - siteConfig.booking.piiRetentionDays * DAY);
  const purged = await db
    .update(bookings)
    .set({ patientName: null, patientEmail: null, patientPhone: null, piiPurgedAt: now })
    .where(
      and(
        isNull(bookings.piiPurgedAt),
        or(
          and(ne(bookings.status, "cancelled"), lt(bookings.endsAt, cutoff)),
          and(eq(bookings.status, "cancelled"), lt(bookings.cancelledAt, cutoff)),
        ),
      ),
    )
    .returning({ id: bookings.id });

  const expiredSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now.getTime() - DAY)))
    .returning({ id: sessions.id });

  await db.delete(rateLimits).where(lt(rateLimits.lastRequest, now.getTime() - DAY));

  return {
    expiredHolds: expiredHolds.length,
    callsClosed: closed.callsClosed,
    completed: completed.length + closed.completed,
    missed: closed.missed,
    purged: purged.length,
    expiredSessions: expiredSessions.length,
  };
}
