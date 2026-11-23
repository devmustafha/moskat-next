import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { siteConfig } from "@/lib/site";

/**
 * Request limits counted in the `rate_limits` table that Better Auth also uses (keys here start
 * with "booking:", "consult-token:" or "consult-call:", so they never collide with Better Auth's).
 * Counting in Postgres works across all of Vercel's server instances; the daily job deletes rows
 * older than a day.
 */

const WINDOW_MS = 60_000;

/** The visitor's IP address. Vercel sets x-forwarded-for itself, so a client can't spoof it. */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Counts one request for `key` and returns true when it's over `max` for the current window.
 * One atomic upsert: a window that has passed starts again at 1. (`last_request` holds the window start.)
 */
export async function isRateLimited(db: Db, key: string, max: number, now = Date.now(), windowMs = WINDOW_MS) {
  const expired = now - windowMs;
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, last_request) values (${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limits.last_request <= ${expired} then 1 else rate_limits.count + 1 end,
      last_request = case when rate_limits.last_request <= ${expired} then ${now} else rate_limits.last_request end
    returning count`);
  return Number(result.rows[0]?.count ?? 0) > max;
}

/** Booking attempts per visitor IP. */
export function isBookingRateLimited(db: Db, ip: string, now = Date.now()) {
  return isRateLimited(db, `booking:${ip}`, siteConfig.booking.attemptsPerMinute, now);
}

/** Video-call token requests (joins and renewals) per signed-in user. */
export function isConsultationTokenRateLimited(db: Db, userId: string, now = Date.now()) {
  return isRateLimited(db, `consult-token:${userId}`, siteConfig.consultation.tokenRequestsPerMinute, now);
}

/** Video-call attendance reports, status checks and "end" requests per signed-in user. */
export function isConsultationCallRateLimited(db: Db, userId: string, now = Date.now()) {
  return isRateLimited(db, `consult-call:${userId}`, siteConfig.consultation.callRequestsPerMinute, now);
}
