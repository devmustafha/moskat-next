import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Better Auth tables (core + admin plugin), in the shape Better Auth 1.7 expects.
 * The TypeScript keys are Better Auth's field names; don't rename them. Tables are plural
 * (`usePlural: true` in lib/auth/auth.ts), so `user` never needs quoting in SQL.
 * If a Better Auth upgrade or a new plugin adds fields, compare with `npx auth@latest generate`.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const roles = ["patient", "doctor", "admin"] as const;
export type Role = (typeof roles)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    /** Always false for now: email verification isn't implemented. */
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** One role per account. Public sign-up always creates a patient; only admins assign others. */
    role: text("role").$type<Role>().notNull().default("patient"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    check("users_role_check", sql`${table.role} in ('patient', 'doctor', 'admin')`),
    check("users_name_length_check", sql`char_length(${table.name}) between 1 and 120`),
    check("users_email_length_check", sql`char_length(${table.email}) <= 254`),
    // Better Auth lowercases emails; this keeps "A@x" and "a@x" from becoming two accounts.
    check("users_email_lowercase_check", sql`${table.email} = lower(${table.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The session cookie's token. */
    token: text("token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Admin plugin field. Impersonation is not permitted (lib/auth/permissions.ts), so always null. */
    impersonatedBy: uuid("impersonated_by"),
    ...timestamps,
  },
  (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expires_idx").on(table.expiresAt)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    /** Only "credential" (email + password) for now. */
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Password hash from lib/auth/password.ts. Never the password. */
    password: text("password"),
    // OAuth fields: unused (no social login) but part of Better Auth's account model.
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    ...timestamps,
  },
  (table) => [index("accounts_user_idx").on(table.userId)],
);

/** Better Auth core table. Unused until email verification or password reset exist. */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

/**
 * Better Auth's rate-limit counters (`rateLimit.storage: "database"`): one row per visitor IP
 * and endpoint. Better Auth deletes expired rows itself; the daily job removes any left over.
 */
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  /** Milliseconds since the epoch. */
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export type UserRow = typeof users.$inferSelect;
