import { NextResponse } from "next/server";

/**
 * Privacy headers for pages that show personal or live data:
 * - /bookings/<token> shows a patient's booking: never cache it, never index it, and never
 *   send the token-bearing URL on as a referrer.
 * - /doctors/<slug>/book shows live availability: never cache it.
 * - Sign-in, the auth API and the signed-in areas (account, doctor, admin) are per-user.
 * Access control itself is done by the guards in lib/auth/session.ts, not here.
 */
export function proxy() {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/bookings/:path*",
    "/doctors/:slug/book",
    "/sign-in",
    "/sign-up",
    "/api/auth/:path*",
    "/account/:path*",
    "/doctor/:path*",
    "/admin/:path*",
  ],
};
