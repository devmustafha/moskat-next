import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { siteConfig } from "@/lib/site";

/**
 * Booking attempts per visitor, counted in the `rate_limits` table that Better Auth also uses
 * (keys here start with "booking:", so they never collide with Better Auth's). Counting in Postgres
 * works across all of Vercel's server instances; the daily job deletes rows older than a day.
 */

const WINDOW_MS = 60_000;

/** The visitor's IP address. Vercel sets x-forwarded-for itself, so a client can't spoof it. */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Counts this attempt and returns true when the visitor is over the limit for the current window.
 * One atomic upsert: a window that has passed starts again at 1. (`last_request` holds the window start.)
 */
export async function isBookingRateLimited(db: Db, ip: string, now = Date.now()) {
  const key = `booking:${ip}`;
  const expired = now - WINDOW_MS;
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, last_request) values (${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limits.last_request <= ${expired} then 1 else rate_limits.count + 1 end,
      last_request = case when rate_limits.last_request <= ${expired} then ${now} else rate_limits.last_request end
    returning count`);
  return Number(result.rows[0]?.count ?? 0) > siteConfig.booking.attemptsPerMinute;
}
