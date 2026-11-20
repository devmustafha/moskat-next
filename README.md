# Moskat

Hospital & medical supplies storefront built with Next.js 16 (App Router), TypeScript and
Tailwind CSS, with online video-consultation booking and patient, doctor and admin accounts.
It runs on [Vercel](https://vercel.com) with [Neon](https://neon.tech) Postgres and sends email
through [Resend](https://resend.com).

## Requirements

- Node.js `>= 22.23.0` (see `.nvmrc`)

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the local dev server (http://localhost:3000) |
| `npm run build`     | Production build                             |
| `npm run start`     | Serve the production build locally           |
| `npm run typecheck` | Type-check the project                       |
| `npm test`          | Unit tests (Vitest) for the pure modules in `lib/` |
| `npm run db:migrate`| Apply migrations in `drizzle/` to `DATABASE_URL` |
| `npm run db:seed`   | Load the sample departments and doctors      |
| `npm run db:studio` | Browse and edit data (Drizzle Studio)        |
| `npm run db:generate` | Generate a migration after changing `lib/db/schema.ts` |
| `npm run db:maintenance` | Run the daily booking clean-up job by hand |
| `npm run auth:create-admin` | Create an admin account (see Authentication) |
| `npm run auth:check` | Check access rules over HTTP (see Authentication) |

Deploys happen on Vercel from git: every push builds a preview, and the production branch
deploys production.

## Project structure

```
app/                     Routes (App Router)
  page.tsx               Home
  about/                 About the hospital
  departments/[slug]/    Department index and one page per department
  doctors/[slug]/        Doctor directory (search + filters) and profiles
  doctors/[slug]/book/   Choose a slot and book a video consultation
  bookings/[token]/      Private page to view or cancel a booking
  sign-in/ sign-up/      Accounts (Better Auth)
  account/               Profile; a patient's bookings and past consultations
  doctor/                A doctor's queue, schedule and patients
  admin/                 Bookings, doctors, pricing and departments
  pricing/ contact/ faq/ privacy/ articles/   Content pages
  api/auth/              Better Auth endpoint
  api/cron/maintenance/  The daily job (Vercel Cron)
  api/health/            GET /api/health health check
  styleguide/            Design system reference (dev only)
components/
  ui/                    Design system primitives (Button, Card, PageHeader, …)
  layout/                Emergency bar, header, footer, navigation
  shared/                EmergencyNotice, OpeningHours, CtaBand
  auth/ account/ bookings/ doctor/ admin/   Area-specific components
  home/ doctors/ departments/ articles/     Page sections and cards
lib/
  site.ts                Name, contact details, hours, navigation, booking and auth rules
  db/                    Drizzle schema, queries, pooled server client, seed data, daily job
  auth/                  Better Auth config, session guards, password hashing, policy
  booking/               Slots, create/cancel, tokens, statuses, emails, rate limit
  account/ doctor/ admin/   Data access for each signed-in area
  email/resend.ts        Sends email through Resend
  data/                  Static content: pricing, FAQs, articles, trust signals
drizzle/                 SQL migrations (committed)
scripts/                 create-admin and the access check
proxy.ts                 Privacy headers for booking and signed-in pages
vercel.json              Cron schedule for the daily job
```

## Database

Doctors, departments, weekly video hours, time off, bookings and accounts live in **Neon
Postgres**. The schema is `lib/db/schema.ts` (plus `lib/db/auth-schema.ts`); migrations are in
`drizzle/`. Double-booking is prevented by an exclusion constraint in the database
(`drizzle/0001_booking_overlap.sql`), not just by application code.

The app connects through one `pg` pool per server instance (`lib/db/server.ts`). Scripts and
migrations open their own connection (`lib/db/client.ts`).

### Connection strings

| Where | `DATABASE_URL` | Role |
| --- | --- | --- |
| Vercel (runtime) | Neon **pooled** string (host contains `-pooler`) | `moskat_web` (limited) |
| `.env` (migrations, seed, scripts, `npm run dev`) | Neon **direct** string (no `-pooler`) | owner |

### One-time setup

1. **Neon.** Create a project and a branch per environment (for example `main` for production
   and `dev` for previews and local work).
2. **Migrate and seed each branch** with its *direct* owner connection string in `.env`:

   ```sh
   npm run db:migrate && npm run db:seed
   ```

   The migrations create the `moskat_app` group role and its grants.
3. **Create the website's database user** on each branch (Neon SQL editor), and keep the password
   out of git:

   ```sql
   CREATE ROLE moskat_web LOGIN PASSWORD '<strong password>';
   GRANT moskat_app TO moskat_web;  -- read catalogue; create/update bookings; no deletes
   ```

4. **Vercel.** Import the repository as a project, then set these environment variables, with
   separate values for Production and Preview:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Pooled connection string for that branch, as `moskat_web` |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32`, one per environment |
   | `PASSWORD_PEPPER` | `openssl rand -base64 32`, one per environment; never change it once accounts exist |
   | `BETTER_AUTH_URL` | The site's public origin (Production); previews fall back to their own URL |
   | `RESEND_API_KEY` | Resend API key |
   | `CRON_SECRET` | Random string; Vercel Cron sends it to the daily job |

5. **Email.** Verify the sending domain in Resend and set the sender in `siteConfig.email.from`.
   Without `RESEND_API_KEY`, bookings still work and the confirmation page shows the manage link.
6. **Daily job.** `vercel.json` schedules `/api/cron/maintenance` at 03:15 UTC. It marks finished
   consultations completed, clears expired patient details, and deletes old sessions and
   rate-limit counters. It refuses requests without `Authorization: Bearer <CRON_SECRET>`.

### Local development

Copy `.env.example` to `.env` and fill it in. `npm run dev` connects straight to `DATABASE_URL`
(use a non-production branch). Booking emails are only sent if `RESEND_API_KEY` is set.

On slow connections Node gives up on each database address after 250 ms and fails with
`ETIMEDOUT`. `lib/db/connect-timeout.ts` raises that to 10 s for the app, scripts and drizzle-kit.

### Releasing

Migrations must be additive so the running site keeps working while a deploy finishes.

1. Migrate the preview branch (`.env` pointing at it), push, and test the Vercel preview.
2. `DATABASE_URL=$DATABASE_URL_MAIN npm run db:migrate`, then merge to the production branch.

### Authentication

Accounts use [Better Auth](https://better-auth.com) with email and password, stored in the same
database (`users`, `sessions`, `accounts`, `verifications`, `rate_limits`; config in `lib/auth/auth.ts`). Roles
are `patient` (public sign-up), `doctor` and `admin` (assigned by an admin).

- **Secrets, per environment:** `BETTER_AUTH_SECRET` (signs cookies) and `PASSWORD_PEPPER`
  (mixed into every password hash). Generate each with `openssl rand -base64 32`. Keep them in
  `.env` for local work and as Vercel environment variables for each environment. **Never change a
  pepper once accounts exist:** every password would stop working.
- **Origin:** Better Auth binds cookies to `BETTER_AUTH_URL` and only accepts sign-in requests from
  it (CSRF protection). Without it, a Vercel deployment uses its own URL, and local dev uses
  `http://localhost:3000`.
- **Pages:** `/sign-in`, `/sign-up` (patients only) and `/account` (any signed-in user: profile,
  change password, sign out). Signed-out visitors are sent to sign in; wrong roles get a 403 page.
- **Patients** see `/account/bookings` (upcoming, with cancel) and `/account/consultations` (past).
  Only bookings made while signed in are linked to the account (`patient_user_id`); guest bookings
  are never matched by email, since emails aren't verified. Another patient's booking is a 404.
- **Doctors** see `/doctor/queue` (today's and upcoming consultations), `/doctor` (weekly hours and
  time off) and `/doctor/patients/<id>`. They edit their own weekly hours on `/doctor/hours` (from
  today; existing bookings are kept and listed if the new hours don't cover them) and their bio,
  qualifications, languages, interests, experience, fee and length on `/doctor/profile`. Name,
  specialty, department, photo and time off stay with the hospital. A doctor account must be linked to an active
  doctor profile (`doctors.user_id`); until then it only sees a "not linked yet" page. A patient's
  page needs a non-cancelled booking with that doctor and shows only that doctor's bookings;
  anyone else is a 404.
- **Admins** use `/admin/bookings` (cancel on the hospital's behalf, mark as missed),
  `/admin/doctors` (create a doctor's account and link it to their profile; block or unblock it),
  `/admin/pricing` (fee and length) and `/admin/departments` (page text, listed or not). Admins
  can't impersonate, delete accounts or open the doctor and patient areas. Changing an account's
  role away from `doctor` unlinks its profile. Known limit: an admin could still create a doctor
  account for themselves, so the separation holds against an admin's session, not against an admin.
- **Sessions** end after 2 hours without activity, and always 12 hours after signing in
  (`siteConfig.auth`). Sign-in is limited to 10 attempts a minute per visitor, and booking to 5
  (counted in `rate_limits` by IP address, from Vercel's `x-forwarded-for`).
- **First admin:** `npm run auth:create-admin -- --email <email> --name "<name>"` against the
  branch in `DATABASE_URL`, with that environment's pepper. It asks for the password.
- **Doctor accounts (dev and staging):** `npm run auth:create-doctors` creates an account
  `<slug>@moskat.example` (`--domain` to change it) for every active doctor profile without one,
  links it, and gives them all the password it asks for. Refuses to run against `DATABASE_URL_MAIN`.
- **Password hashing** is scrypt N=16384, r=16, p=1 with a pepper (`lib/auth/password.ts`).
  Hashes carry their parameters, so they can be raised later without resetting passwords.
- **Access check:** `npm run auth:check -- --base-url http://localhost:3000` (or a preview URL)
  signs in as each role over HTTP and checks who can see what, plus sessions, cookies and abuse
  limits (`scripts/check-auth.ts`). It sets up its own users, links and bookings in the database in
  `DATABASE_URL` (which must be the one behind `--base-url`), deletes them afterwards, runs the
  daily job once, and ends by tripping the sign-in limit, so sign-in from your machine is blocked
  for a minute. It refuses to run against production (`DATABASE_URL_MAIN`, or `PRODUCTION_URL`
  if set). Run it after any auth or access change.

### Day-to-day

- **Edit doctors, hours and time off** with `npm run db:studio` (owner connection). Weekly hours
  (`doctor_availability`) are local wall-clock times in the doctor's `time_zone`; time off
  (`doctor_time_off`) is a UTC time range.
- **Booking statuses:** `confirmed` → `cancelled` (patient online until 2 h before, or staff),
  `completed` (automatically 24 h after the end) or `no_show` (staff).
- **Patient data:** only name, email and optional phone are stored. The daily job clears them
  90 days after the appointment or cancellation (`siteConfig.booking.piiRetentionDays`).
