/**
 * Create an admin account (the first one, or more):
 *
 *   npm run auth:create-admin -- --email admin@example.com --name "Ada Admin"
 *
 * Asks for the password without echoing it (or reads it from stdin when piped), so it never
 * lands in shell history. Uses from .env: DATABASE_URL (owner connection), BETTER_AUTH_SECRET and
 * PASSWORD_PEPPER. The pepper must be the one the deployed site for that database uses, or the admin
 * won't be able to sign in.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createAuth } from "@/lib/auth/auth";
import { withDb } from "@/lib/db/client";
import { safeErrorSummary } from "@/lib/db/errors";
import { siteConfig } from "@/lib/site";

try {
  process.loadEnvFile();
} catch {}

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
const { DATABASE_URL, BETTER_AUTH_SECRET, PASSWORD_PEPPER } = process.env;
if (!values.email || !values.name) throw new Error('Usage: npm run auth:create-admin -- --email <email> --name "<name>"');
if (!DATABASE_URL || !BETTER_AUTH_SECRET || !PASSWORD_PEPPER) {
  throw new Error("Set DATABASE_URL, BETTER_AUTH_SECRET and PASSWORD_PEPPER (see .env.example).");
}

/** Reads one line; when interactive, without echoing what's typed. */
async function readSecret(prompt: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (process.stdin.isTTY) {
    process.stdout.write(prompt);
    // Echo nothing while the password is typed.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  }
  const line = await new Promise<string>((resolve) => rl.once("line", resolve));
  rl.close();
  if (process.stdin.isTTY) process.stdout.write("\n");
  return line;
}

const password = await readSecret("Password: ");
if (password.length < siteConfig.auth.minPasswordLength) {
  throw new Error(`The password must be at least ${siteConfig.auth.minPasswordLength} characters.`);
}
if (process.stdin.isTTY && (await readSecret("Repeat password: ")) !== password) {
  throw new Error("The passwords don't match.");
}

try {
  const { user } = await withDb(DATABASE_URL, (db) =>
    createAuth(db, {
      baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      secret: BETTER_AUTH_SECRET,
      pepper: PASSWORD_PEPPER,
    }).api.createUser({ body: { email: values.email!, name: values.name!, password, role: "admin" } }),
  );
  console.log(`Created admin ${user.email} (${user.id}).`);
} catch (error) {
  // Better Auth's own errors (e.g. "User already exists") are safe to show; database errors aren't.
  const message = error instanceof Error && error.name === "APIError" ? error.message : safeErrorSummary(error);
  console.error(`Couldn't create the admin: ${message}`);
  process.exitCode = 1;
}
