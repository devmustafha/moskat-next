import { createAuthClient } from "better-auth/client";

/**
 * Browser client for Better Auth's endpoints (sign-in, sign-up, sign-out, change password).
 * Session checks happen on the server (lib/auth/session.ts), never with this client.
 */
export const authClient = createAuthClient();
