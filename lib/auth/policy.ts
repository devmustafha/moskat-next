import { siteConfig } from "@/lib/site";

/**
 * Pure auth rules, shared by server and client code and unit-tested.
 */

/**
 * The `next` redirect target after signing in, if it is a path on this site. Anything else
 * (absolute URLs, protocol-relative `//host`, backslash tricks) would be an open redirect.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  // Control characters (including tab and newline, which browsers strip) can hide a second slash.
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}

/** True when a session is older than the absolute limit, however recently it was used. */
export function isPastAbsoluteLifetime(createdAt: Date, now: Date) {
  return now.getTime() - createdAt.getTime() > siteConfig.auth.absoluteLifetimeHours * 60 * 60 * 1000;
}
