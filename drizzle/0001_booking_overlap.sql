-- Prevent double-booking in the database itself: a doctor can't have two slot-holding
-- bookings whose time ranges overlap. Cancelled bookings don't hold their slot.
-- Keep the WHERE clause in sync with slotHoldingStatuses in lib/booking/status.ts.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "consultation_bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("doctor_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" <> 'cancelled');
