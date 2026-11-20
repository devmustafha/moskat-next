import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import type { Db } from "@/lib/db/client";
import { accounts, rateLimits, sessions, users, verifications } from "@/lib/db/auth-schema";
import { doctors } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";
import { ac, authRoles } from "./permissions";
import { createPasswordHasher } from "./password";

export type AuthConfig = {
  /** The site's origin, e.g. https://moskat.vercel.app. Cookies are bound to it. */
  baseURL: string;
  /** Signs session cookies. At least 32 characters. */
  secret: string;
  /** See lib/auth/password.ts. Validated there. */
  pepper: string;
};

/** Admin endpoints an admin may not use on their own account (no self-demotion or lock-out). */
const NOT_ON_SELF_PATHS = new Set(["/admin/set-role", "/admin/ban-user", "/admin/revoke-user-sessions"]);

/**
 * Better Auth on a database handle (the app's pool, or a script's own connection). Reads no env
 * itself, so scripts can use it too; the app's wiring is lib/auth/session.ts.
 */
export function createAuth(db: Db, config: AuthConfig) {
  const { auth: rules } = siteConfig;
  const hasher = createPasswordHasher(config.pepper);
  const secure = config.baseURL.startsWith("https://");

  return betterAuth({
    appName: siteConfig.name,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications, rateLimits },
    }),

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: rules.minPasswordLength,
      maxPasswordLength: rules.maxPasswordLength,
      password: hasher,
    },

    session: {
      expiresIn: rules.idleTimeoutHours * 60 * 60,
      updateAge: rules.refreshMinutes * 60,
      // Every request reads the session from the database, so sign-out, bans and role changes
      // apply immediately.
      cookieCache: { enabled: false },
    },

    // Counted per visitor IP in Postgres: memory counters would be per server instance, and
    // Vercel runs many.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: rules.attemptsPerMinute },
        "/sign-up/email": { window: 60, max: rules.attemptsPerMinute },
        "/change-password": { window: 60, max: rules.attemptsPerMinute },
      },
    },

    advanced: {
      cookiePrefix: "moskat",
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, secure, sameSite: "lax", path: "/" },
      // Vercel sets x-forwarded-for itself (a client can't spoof it); Better Auth uses its first address.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
      database: { generateId: "uuid" },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // The admin plugin only checks the maximum length, so apply the minimum here too.
        const adminPassword = ctx.path === "/admin/create-user" ? ctx.body?.password : ctx.path === "/admin/set-user-password" ? ctx.body?.newPassword : undefined;
        if (typeof adminPassword === "string" && adminPassword.length < rules.minPasswordLength) {
          throw new APIError("BAD_REQUEST", { message: `Passwords must be at least ${rules.minPasswordLength} characters.` });
        }
        if (NOT_ON_SELF_PATHS.has(ctx.path)) {
          const session = await getSessionFromCtx(ctx);
          if (session && ctx.body?.userId === session.user.id) {
            throw new APIError("FORBIDDEN", { message: "You can't change your own role or access." });
          }
        }
      }),
    },

    databaseHooks: {
      user: {
        create: {
          // Public sign-up always creates a patient, whatever the request body says.
          // (The admin plugin already ignores `role` from sign-up; this is the second guard.)
          before: async (user, ctx) => {
            if (ctx?.path === "/sign-up/email") return { data: { ...user, role: "patient" } };
          },
        },
        update: {
          // An account that stops being a doctor (admin set-role) loses its doctor profile link.
          // requireDoctor checks the role anyway; this keeps the link from silently coming back.
          after: async (user) => {
            if (typeof user.role === "string" && user.role !== "doctor") {
              await db
                .update(doctors)
                .set({ userId: null })
                .where(eq(doctors.userId, user.id));
            }
          },
        },
      },
    },

    plugins: [
      admin({
        ac,
        roles: authRoles,
        defaultRole: "patient",
        adminRoles: ["admin"],
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
