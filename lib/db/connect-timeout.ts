import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

/**
 * Node tries each address a host resolves to (IPv6 and IPv4) for only 250 ms before moving on. On
 * a high-latency link to Neon every attempt times out, so connections fail with ETIMEDOUT even
 * though psql works. Give each attempt 10 s instead. On Vercel connections finish well inside
 * either limit, so this changes nothing there.
 *
 * Process-wide; imported for its side effect by everything that opens a database connection.
 */
setDefaultAutoSelectFamilyAttemptTimeout(10_000);
