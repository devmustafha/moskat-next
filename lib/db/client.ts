import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "@/lib/db/schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Open a Drizzle client on a single pg connection, for scripts and one-off jobs (seed, maintenance,
 * create-admin, auth:check). The app itself uses the pool in lib/db/server.ts.
 */
export async function connect(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  const db: Db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}

/** Run `fn` with a fresh connection and always close it (scripts). */
export async function withDb<T>(connectionString: string, fn: (db: Db) => Promise<T>) {
  const { db, close } = await connect(connectionString);
  try {
    return await fn(db);
  } finally {
    await close().catch(() => {});
  }
}
