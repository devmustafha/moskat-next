import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings, rateLimits, sessions } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Daily housekeeping (cron trigger, or `npm run db:maintenance`):
 * 1. Confirmed consultations that ended over 24 hours ago become `completed`
 *    (staff can still correct one to `no_show`).
 * 2. Patient name, email and phone are cleared once a booking is past the retention period,
 *    counted from the appointment end, or from the cancellation for cancelled bookings.
 *    The anonymous row stays for scheduling history.
 * 3. Sign-in sessions that expired over a day ago are deleted (they hold IP address and browser),
 *    as are sign-in rate-limit counters older than a day (keyed by IP address).
 */
export async function runMaintenance(db: Db, now: Date) {
  const completed = await db
    .update(bookings)
    .set({ status: "completed" })
    .where(and(eq(bookings.status, "confirmed"), lt(bookings.endsAt, new Date(now.getTime() - DAY))))
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

  return { completed: completed.length, purged: purged.length, expiredSessions: expiredSessions.length };
}
