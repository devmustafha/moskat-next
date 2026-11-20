-- Website role (moskat_app, see 0002_app_role.sql) access for authentication and the admin area.
-- Accounts are never deleted (admins ban instead), so users and accounts get no DELETE.
GRANT SELECT, INSERT, UPDATE ON users, accounts TO moskat_app;
--> statement-breakpoint
-- Sign-out and session revocation delete rows; verifications are single-use.
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, verifications TO moskat_app;
--> statement-breakpoint
-- Admin area: only the columns its forms change (fees, visit length, active, account link).
GRANT UPDATE (consultation_fee_cents, consultation_minutes, is_active, user_id, updated_at) ON doctors TO moskat_app;
--> statement-breakpoint
GRANT UPDATE (name, summary, intro, location, is_active, sort_order, updated_at) ON departments TO moskat_app;
