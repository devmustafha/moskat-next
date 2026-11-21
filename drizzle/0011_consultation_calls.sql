CREATE TYPE "public"."consultation_ended_by" AS ENUM('doctor', 'system');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'in_progress';--> statement-breakpoint
CREATE TABLE "consultation_calls" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"channel_name" text NOT NULL,
	"doctor_joined_at" timestamp with time zone,
	"patient_joined_at" timestamp with time zone,
	"doctor_left_at" timestamp with time zone,
	"patient_left_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_by" "consultation_ended_by",
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultation_calls_channel_name_unique" UNIQUE("channel_name"),
	CONSTRAINT "consultation_calls_channel_check" CHECK ("consultation_calls"."channel_name" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "consultation_calls_ended_check" CHECK (("consultation_calls"."ended_at" is null) = ("consultation_calls"."ended_by" is null)),
	CONSTRAINT "consultation_calls_duration_check" CHECK ("consultation_calls"."duration_seconds" is null or "consultation_calls"."duration_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "consultation_calls" ADD CONSTRAINT "consultation_calls_booking_id_consultation_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."consultation_bookings"("id") ON DELETE restrict ON UPDATE no action;