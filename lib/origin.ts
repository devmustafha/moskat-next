/**
 * The site's public origin: BETTER_AUTH_URL, else this Vercel deployment's URL, else local dev.
 * Server-side only (reads env). Used for auth cookies, the Paystack callback URL and links in
 * emails sent from places without a trustworthy Host header (the Paystack webhook).
 */
export function siteOrigin() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** An absolute URL on this site for `path` (which starts with "/"). */
export function siteUrl(path: string) {
  return `${siteOrigin().replace(/\/+$/, "")}${path}`;
}
