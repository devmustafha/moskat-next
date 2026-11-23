import { createHash, timingSafeEqual } from "node:crypto";
import { runMaintenance } from "@/lib/db/maintenance";
import { runWithDb } from "@/lib/db/server";
import { safeErrorSummary } from "@/lib/db/errors";

/**
 * The daily job (vercel.json `crons`): closes finished video calls, marks finished consultations
 * completed (or missed), clears expired patient details, and deletes old sessions and rate-limit
 * counters. Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`; any other caller
 * gets 401.
 */
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Compare digests so the comparison takes the same time whatever the length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runWithDb((db) => runMaintenance(db, new Date()));
    // Counts only: never log patient details.
    console.log(
      `maintenance: expiredHolds=${result.expiredHolds} callsClosed=${result.callsClosed} completed=${result.completed} missed=${result.missed} purged=${result.purged} expiredSessions=${result.expiredSessions}`,
    );
    return Response.json(result);
  } catch (error) {
    console.error(`maintenance failed: ${safeErrorSummary(error)}`);
    return new Response("Maintenance failed", { status: 500 });
  }
}
