CREATE TYPE "public"."payment_status" AS ENUM('initialized', 'succeeded', 'failed', 'needs_review', 'refunded');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'pending_payment';--> statement-breakpoint
ALTER TYPE "public"."cancelled_by" ADD VALUE 'system';--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"reference" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"status" "payment_status" DEFAULT 'initialized' NOT NULL,
	"provider_transaction_id" text,
	"paid_at" timestamp with time zone,
	"review_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference"),
	CONSTRAINT "payments_provider_check" CHECK ("payments"."provider" in ('paystack')),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount_minor" > 0),
	CONSTRAINT "payments_review_reason_check" CHECK ("payments"."review_reason" is null or "payments"."review_reason" in ('amount_mismatch', 'currency_mismatch', 'booking_not_payable', 'cancelled_after_payment'))
);
--> statement-breakpoint
ALTER TABLE "consultation_bookings" ADD COLUMN "payment_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_consultation_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."consultation_bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_success_per_booking" ON "payments" USING btree ("booking_id") WHERE "payments"."status" = 'succeeded';--> statement-breakpoint
CREATE INDEX "bookings_status_payment_expires_idx" ON "consultation_bookings" USING btree ("status","payment_expires_at");