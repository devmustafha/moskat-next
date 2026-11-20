/**
 * `npm run db:maintenance`: the daily job (app/api/cron/maintenance), run from your machine against
 * DATABASE_URL. Use it if Vercel Cron is unavailable, or to test the job.
 */
import { withDb } from "@/lib/db/client";
import { runMaintenance } from "@/lib/db/maintenance";

try {
  process.loadEnvFile();
} catch {}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL before running maintenance.");

const result = await withDb(url, (db) => runMaintenance(db, new Date()));
console.log(`maintenance: completed=${result.completed} purged=${result.purged} expiredSessions=${result.expiredSessions}`);
