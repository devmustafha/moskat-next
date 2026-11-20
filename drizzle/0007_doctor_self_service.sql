-- Doctors manage their own profile, rates and weekly hours (website role moskat_app, see 0002).
-- Fee, consultation length and updated_at on doctors were already granted in 0005.
GRANT UPDATE (bio, qualifications, languages, interests, years_experience) ON doctors TO moskat_app;
--> statement-breakpoint
-- Replacing weekly hours ends past rules (effective_until) and deletes rules that never took
-- effect. Always scoped to the signed-in doctor's own rows in lib/doctor/queries.ts.
GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_availability TO moskat_app;
