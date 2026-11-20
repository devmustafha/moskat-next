import { runWithAuth } from "@/lib/auth/session";

/** Better Auth's endpoints: /api/auth/sign-in/email, /api/auth/sign-up/email, /api/auth/sign-out, … */
function handle(request: Request) {
  return runWithAuth((auth) => auth.handler(request));
}

export const GET = handle;
export const POST = handle;
