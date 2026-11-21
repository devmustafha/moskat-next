-- Every consultation is the same length for every doctor: siteConfig.booking.consultationMinutes
-- (30). Existing bookings keep the times they were booked for (starts_at/ends_at).
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_minutes_check";--> statement-breakpoint
UPDATE "doctors" SET "consultation_minutes" = 30 WHERE "consultation_minutes" <> 30;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "consultation_minutes" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_minutes_check" CHECK ("doctors"."consultation_minutes" = 30);--> statement-breakpoint
-- Neither doctors nor admins set the length any more (granted in 0005).
REVOKE UPDATE (consultation_minutes) ON doctors FROM moskat_app;
