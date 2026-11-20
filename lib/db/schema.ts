import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { ImageAsset } from "@/lib/images";
import type { Service } from "@/lib/db/types";
import { siteConfig } from "@/lib/site";
import { users } from "@/lib/db/auth-schema";

export * from "@/lib/db/auth-schema";

/**
 * Database schema. Migrations are generated from this file with `npm run db:generate`.
 * Constraints drizzle-kit can't express (the no-overlap exclusion constraint and the app role)
 * live in hand-written migrations in drizzle/.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const departments = pgTable(
  "departments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    summary: text("summary").notNull(),
    intro: text("intro").notNull(),
    location: text("location").notNull(),
    services: jsonb("services").$type<Service[]>().notNull().default([]),
    conditions: text("conditions").array().notNull().default(sql`'{}'::text[]`),
    offersVideoVisits: boolean("offers_video_visits").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    check(
      "departments_icon_check",
      sql`${table.icon} in ('heart-pulse', 'baby', 'venus', 'bone', 'brain', 'microscope')`,
    ),
  ],
);

export const doctors = pgTable(
  "doctors",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    specialty: text("specialty").notNull(),
    yearsExperience: smallint("years_experience").notNull(),
    qualifications: text("qualifications").array().notNull().default(sql`'{}'::text[]`),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    bio: text("bio").array().notNull().default(sql`'{}'::text[]`),
    interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
    photo: jsonb("photo").$type<ImageAsset>(),
    /** Online consultation fee in minor units (cents). Never a float. */
    consultationFeeCents: integer("consultation_fee_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default(siteConfig.currency),
    consultationMinutes: smallint("consultation_minutes").notNull(),
    /** IANA time zone the weekly availability is written in; defaults to the hospital's. */
    timeZone: text("time_zone").notNull().default(siteConfig.timeZone),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** The doctor's sign-in account (role `doctor`), linked by an admin. One account per profile. */
    userId: uuid("user_id")
      .unique()
      .references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("doctors_department_idx").on(table.departmentId),
    check("doctors_fee_check", sql`${table.consultationFeeCents} > 0`),
    check("doctors_minutes_check", sql`${table.consultationMinutes} between 10 and 120`),
    check("doctors_experience_check", sql`${table.yearsExperience} >= 0`),
  ],
);

/** Weekly video consultation hours, in the doctor's local wall-clock time. */
export const doctorAvailability = pgTable(
  "doctor_availability",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    doctorId: integer("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    effectiveFrom: date("effective_from").notNull().defaultNow(),
    /** Last day this rule applies (inclusive); null = open-ended. */
    effectiveUntil: date("effective_until"),
    ...timestamps,
  },
  (table) => [
    index("doctor_availability_doctor_idx").on(table.doctorId),
    check("doctor_availability_weekday_check", sql`${table.weekday} between 1 and 7`),
    check("doctor_availability_time_check", sql`${table.endTime} > ${table.startTime}`),
    check(
      "doctor_availability_dates_check",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} >= ${table.effectiveFrom}`,
    ),
  ],
);

/** Exceptions to the weekly hours: leave, training, public holidays. */
export const doctorTimeOff = pgTable(
  "doctor_time_off",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    doctorId: integer("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    index("doctor_time_off_doctor_idx").on(table.doctorId, table.startsAt),
    check("doctor_time_off_range_check", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const bookingStatus = pgEnum("booking_status", ["confirmed", "cancelled", "completed", "no_show"]);
export const cancelledBy = pgEnum("cancelled_by", ["patient", "hospital"]);

export const consultationBookings = pgTable(
  "consultation_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short code for phone support. Never enough on its own to see booking details. */
    reference: text("reference").notNull().unique(),
    /** SHA-256 (hex) of the private manage-link token. The token itself is never stored. */
    manageTokenHash: text("manage_token_hash").notNull().unique(),
    doctorId: integer("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("confirmed"),
    /** Fee copied from the doctor when booked, so later fee changes don't alter it. */
    feeCents: integer("fee_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    /** Patient details: the minimum needed to run the appointment. Cleared after the retention period. */
    patientName: text("patient_name"),
    patientEmail: text("patient_email"),
    patientPhone: text("patient_phone"),
    /**
     * The patient's account, set only when a signed-in patient books. Guest bookings stay null,
     * and existing bookings are never linked by email (emails aren't verified).
     */
    patientUserId: uuid("patient_user_id").references(() => users.id, { onDelete: "set null" }),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: cancelledBy("cancelled_by"),
    piiPurgedAt: timestamp("pii_purged_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("bookings_doctor_starts_idx").on(table.doctorId, table.startsAt),
    index("bookings_status_ends_idx").on(table.status, table.endsAt),
    index("bookings_patient_starts_idx").on(table.patientUserId, table.startsAt),
    index("bookings_doctor_patient_idx").on(table.doctorId, table.patientUserId),
    check("bookings_range_check", sql`${table.endsAt} > ${table.startsAt}`),
    check("bookings_fee_check", sql`${table.feeCents} >= 0`),
    check("bookings_name_length_check", sql`char_length(${table.patientName}) <= 120`),
    check("bookings_email_length_check", sql`char_length(${table.patientEmail}) <= 254`),
    check("bookings_phone_length_check", sql`char_length(${table.patientPhone}) <= 32`),
    // Patient details are required until they are purged.
    check(
      "bookings_pii_present_check",
      sql`${table.piiPurgedAt} is not null or (${table.patientName} is not null and ${table.patientEmail} is not null)`,
    ),
    check(
      "bookings_cancelled_check",
      sql`(${table.status} = 'cancelled') = (${table.cancelledAt} is not null)`,
    ),
  ],
);

export type DepartmentRow = typeof departments.$inferSelect;
export type DoctorRow = typeof doctors.$inferSelect;
export type AvailabilityRow = typeof doctorAvailability.$inferSelect;
export type TimeOffRow = typeof doctorTimeOff.$inferSelect;
export type BookingRow = typeof consultationBookings.$inferSelect;
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
