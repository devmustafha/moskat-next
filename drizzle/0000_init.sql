CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."cancelled_by" AS ENUM('patient', 'hospital');--> statement-breakpoint
CREATE TABLE "consultation_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"manage_token_hash" text NOT NULL,
	"doctor_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"fee_cents" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"patient_name" text,
	"patient_email" text,
	"patient_phone" text,
	"consented_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" "cancelled_by",
	"pii_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultation_bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "consultation_bookings_manage_token_hash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "bookings_range_check" CHECK ("consultation_bookings"."ends_at" > "consultation_bookings"."starts_at"),
	CONSTRAINT "bookings_fee_check" CHECK ("consultation_bookings"."fee_cents" >= 0),
	CONSTRAINT "bookings_name_length_check" CHECK (char_length("consultation_bookings"."patient_name") <= 120),
	CONSTRAINT "bookings_email_length_check" CHECK (char_length("consultation_bookings"."patient_email") <= 254),
	CONSTRAINT "bookings_phone_length_check" CHECK (char_length("consultation_bookings"."patient_phone") <= 32),
	CONSTRAINT "bookings_pii_present_check" CHECK ("consultation_bookings"."pii_purged_at" is not null or ("consultation_bookings"."patient_name" is not null and "consultation_bookings"."patient_email" is not null)),
	CONSTRAINT "bookings_cancelled_check" CHECK (("consultation_bookings"."status" = 'cancelled') = ("consultation_bookings"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "departments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"summary" text NOT NULL,
	"intro" text NOT NULL,
	"location" text NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditions" text[] DEFAULT '{}'::text[] NOT NULL,
	"offers_video_visits" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_slug_unique" UNIQUE("slug"),
	CONSTRAINT "departments_icon_check" CHECK ("departments"."icon" in ('heart-pulse', 'baby', 'venus', 'bone', 'brain', 'microscope'))
);
--> statement-breakpoint
CREATE TABLE "doctor_availability" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_availability_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"effective_from" date DEFAULT now() NOT NULL,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctor_availability_weekday_check" CHECK ("doctor_availability"."weekday" between 1 and 7),
	CONSTRAINT "doctor_availability_time_check" CHECK ("doctor_availability"."end_time" > "doctor_availability"."start_time"),
	CONSTRAINT "doctor_availability_dates_check" CHECK ("doctor_availability"."effective_until" is null or "doctor_availability"."effective_until" >= "doctor_availability"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "doctor_time_off" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_time_off_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctor_time_off_range_check" CHECK ("doctor_time_off"."ends_at" > "doctor_time_off"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"department_id" integer NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"years_experience" smallint NOT NULL,
	"qualifications" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"bio" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"photo" jsonb,
	"consultation_fee_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"consultation_minutes" smallint NOT NULL,
	"time_zone" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctors_slug_unique" UNIQUE("slug"),
	CONSTRAINT "doctors_fee_check" CHECK ("doctors"."consultation_fee_cents" > 0),
	CONSTRAINT "doctors_minutes_check" CHECK ("doctors"."consultation_minutes" between 10 and 120),
	CONSTRAINT "doctors_experience_check" CHECK ("doctors"."years_experience" >= 0)
);
--> statement-breakpoint
ALTER TABLE "consultation_bookings" ADD CONSTRAINT "consultation_bookings_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_time_off" ADD CONSTRAINT "doctor_time_off_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_doctor_starts_idx" ON "consultation_bookings" USING btree ("doctor_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_ends_idx" ON "consultation_bookings" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "doctor_availability_doctor_idx" ON "doctor_availability" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "doctor_time_off_doctor_idx" ON "doctor_time_off" USING btree ("doctor_id","starts_at");--> statement-breakpoint
CREATE INDEX "doctors_department_idx" ON "doctors" USING btree ("department_id");