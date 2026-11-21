-- Website role (moskat_app, see 0002) access to video calls: create the call when the first
-- participant asks for a token, read it, and record joins, leaves and the end. Never delete.
-- 'in_progress' (added to booking_status in 0011) already holds its slot: the exclusion constraint
-- bookings_no_overlap (0001) applies to every status except 'cancelled'.
GRANT SELECT, INSERT, UPDATE ON consultation_calls TO moskat_app;
