/**
 * Error helpers that never expose data. Drizzle's error messages include the query parameters
 * ("Failed query: … params: …") and Postgres error details echo row values, either of which can
 * contain patient data or token hashes, so log `safeErrorSummary(error)` instead of the message.
 */

/** The Postgres SQLSTATE code (e.g. "23P01"), looking through Drizzle's wrapper error. */
export function pgErrorCode(error: unknown): string | null {
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    if (candidate && typeof candidate === "object" && "code" in candidate && typeof candidate.code === "string") {
      return candidate.code;
    }
  }
  return null;
}

/** "DrizzleQueryError (23505)" or "TypeError": safe to log. */
export function safeErrorSummary(error: unknown) {
  const name = error instanceof Error ? error.name : typeof error;
  const code = pgErrorCode(error);
  return code ? `${name} (${code})` : name;
}
