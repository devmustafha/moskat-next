-- Least-privilege group role for the website. The Worker (through Hyperdrive) connects as a
-- login user that is a member of this role; migrations run as the database owner.
-- No password lives in git: create the login user in Neon and run
--   GRANT moskat_app TO <login user>;
-- (see README: Database).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'moskat_app') THEN
    CREATE ROLE moskat_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO moskat_app;
--> statement-breakpoint
-- Catalogue: read only. Staff edit it with the owner role (Drizzle Studio).
GRANT SELECT ON departments, doctors, doctor_availability, doctor_time_off TO moskat_app;
--> statement-breakpoint
-- Bookings: create, read and update (cancel, status, purge). Never delete.
GRANT SELECT, INSERT, UPDATE ON consultation_bookings TO moskat_app;
