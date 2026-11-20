import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { cache } from "react";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/**
 * Database access for the app (pages, server actions, route handlers). Server-only: never import
 * this from a client component.
 *
 * One pg Pool per server instance. On Vercel, DATABASE_URL is Neon's pooled connection string
 * (host with `-pooler`) as the limited `moskat_web` user; locally it's whatever .env holds.
 * node-postgres sends unnamed statements, so Neon's transaction-mode pooler is fine.
 */

type PoolState = { pool: Pool; db: Db };

// Kept on globalThis so dev hot reload reuses the pool instead of opening new ones.
const store = globalThis as typeof globalThis & { __moskatDb?: PoolState };

function state(): PoolState {
  if (!store.__moskatDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Set DATABASE_URL (see README: Database).");
    const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
    // A dropped idle connection must not crash the process; the pool replaces it.
    pool.on("error", () => {});
    // Lets Vercel close idle connections before a function instance is suspended.
    attachDatabasePool(pool);
    store.__moskatDb = { pool, db: drizzle(pool, { schema }) };
  }
  return store.__moskatDb;
}

/** The database for this render. */
export const getDb = cache(async (): Promise<Db> => state().db);

/** The database for a server action, route handler or job. */
export function runWithDb<T>(fn: (db: Db) => Promise<T>) {
  return fn(state().db);
}
