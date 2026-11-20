import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit runs on your machine, never in the app. DATABASE_URL must be the direct
 * (unpooled) Neon connection string of the branch you're migrating, with the owner role.
 */
// Load .env when present (Node 22+); an exported DATABASE_URL takes precedence.
try {
  process.loadEnvFile();
} catch {}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (see README: Database) before running drizzle-kit.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
