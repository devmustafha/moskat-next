-- Website role (moskat_app, see 0002) access to payments: create a checkout attempt, read it,
-- and update its status (settled from Paystack's verified result, flagged for refund, refunded).
-- Never delete: payments are financial records. SELECT … FOR UPDATE needs UPDATE, granted here.
-- The exclusion constraint bookings_no_overlap (0001) applies to every status except 'cancelled',
-- so unpaid holds (pending_payment) already hold their slot without any change to it.
GRANT SELECT, INSERT, UPDATE ON payments TO moskat_app;
