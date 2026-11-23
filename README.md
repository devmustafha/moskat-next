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
  consultations/[id]/    The video call (lobby and call), for the booking's patient and doctor
  sign-in/ sign-up/      Accounts (Better Auth)
  account/               Profile; a patient's bookings and past consultations
  doctor/                A doctor's queue, schedule and patients
  admin/                 Bookings, doctors, pricing and departments
  pricing/ contact/ faq/ privacy/ articles/   Content pages
  api/auth/              Better Auth endpoint
  api/webhooks/paystack/ Paystack webhook (payment confirmation)
  payments/paystack/     Where Paystack returns the patient after checkout
  api/consultations/     Video call tokens (Agora), for the booking's patient and doctor only
  api/cron/maintenance/  The daily job (Vercel Cron)
  api/health/            GET /api/health health check
  styleguide/            Design system reference (dev only)
components/
  ui/                    Design system primitives (Button, Card, PageHeader, …)
  layout/                Emergency bar, header, footer, navigation
  shared/                EmergencyNotice, OpeningHours, CtaBand
  auth/ account/ bookings/ doctor/ admin/   Area-specific components
  consultation/          The video call screen (Agora Web SDK, client-only)
  home/ doctors/ departments/ articles/     Page sections and cards
lib/
  site.ts                Name, contact details, hours, navigation, booking and auth rules
  db/                    Drizzle schema, queries, pooled server client, seed data, daily job
  auth/                  Better Auth config, session guards, password hashing, policy
  booking/               Slots, create/cancel, tokens, statuses, emails, rate limit
  payments/              Paystack client, webhook signature, checkout, settlement, refunds
  consultation/          Video call access rules, Agora tokens, channels, call screen messages
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
   | `PAYSTACK_SECRET_KEY` | `sk_test_…` for Preview, `sk_live_…` for Production (see Payments) |
   | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | Agora project with App Certificate enabled (see Video consultations) |

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
  qualifications, languages, interests, experience and fee on `/doctor/profile`. Name,
  specialty, department, photo and time off stay with the hospital. A doctor account must be linked to an active
  doctor profile (`doctors.user_id`); until then it only sees a "not linked yet" page. A patient's
  page needs a non-cancelled booking with that doctor and shows only that doctor's bookings;
  anyone else is a 404.
- **Admins** use `/admin/bookings` (cancel on the hospital's behalf, mark as missed),
  `/admin/doctors` (create a doctor's account and link it to their profile; block or unblock it),
  `/admin/pricing` (fee) and `/admin/departments` (page text, listed or not). Admins
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

### Payments (Paystack)

Video consultations are paid online in NGN (amounts are integer kobo) through Paystack's redirect
checkout. Only signed-in patients can book.

1. **Book.** The booking is created as `pending_payment` and holds its slot for
   `siteConfig.booking.paymentHoldMinutes` (30). A `payments` row gets our random reference
   (`MSK-PAY-…`), Paystack's `/transaction/initialize` is called with the amount, the account email and
   only the booking id as metadata, and the patient is sent to Paystack.
2. **Confirm.** A booking becomes `confirmed` only from Paystack's `/transaction/verify` result, fetched
   by our server, when its status, amount, currency and reference match the payment row. Two paths
   lead there, and both are safe to repeat: the webhook (`/api/webhooks/paystack`, `charge.success`,
   checked against `x-paystack-signature`) and the page Paystack returns the patient to
   (`/payments/paystack/callback`). `settlePayment` locks the payment row and confirms the booking in one
   transaction (`lib/payments/settle.ts`).
3. **Unpaid holds** lapse after 30 minutes: the slot is released (status `cancelled`, by `system`)
   when someone books an overlapping time, or by the daily job. A payment that still arrives later is
   flagged for a refund.
4. **Refunds** are done by staff in the Paystack dashboard. A payment is flagged "Refund due" on
   `/admin/bookings` when a paid booking is cancelled (by the patient, until 2 hours before, or by the
   hospital), when the amount or currency doesn't match, or when it can't be used (the hold had lapsed,
   or the booking was already paid). After refunding in Paystack, click **Mark refunded**.

Setup, per environment: put the secret key in `PAYSTACK_SECRET_KEY`, and in the Paystack dashboard
(Settings → API Keys & Webhooks) set the webhook URL to `https://<host>/api/webhooks/paystack`, for
Test mode on Preview and Live mode on Production. The callback URL is sent with each transaction, so
it needs no dashboard setting. Locally, Paystack can't reach `localhost`: the callback page settles the
payment anyway, or use a tunnel to test the webhook.

Checks: `npx tsx scripts/check-payments.ts` settles payments concurrently against `DATABASE_URL`
with Paystack stubbed (idempotency, mismatches, refunds; dev databases only), and
`npx tsx scripts/check-double-booking.ts` races 20 bookings for one slot.

### Video consultations (Agora)

Calls use Agora RTC with token authentication. Tokens are built only on the server
(`lib/consultation/agora.ts`, `agora-token`, Node.js runtime) by
`POST /api/consultations/<bookingId>/token`, which the call page asks for when joining and again
before each token expires. Every request is checked on the server:

- **Who:** a signed-in patient whose account made the booking, or the signed-in doctor whose linked
  profile it's with. Anyone else gets 404, as if the booking didn't exist; signed out gets 401.
  Cross-origin requests get 403. Limited to 10 requests a minute per user.
- **Paid:** the booking is `confirmed` (or `in_progress`) with a succeeded payment, and its call
  hasn't ended. Bookings from before online payment can't use video.
- **When:** from 10 minutes before the start; a first join until 30 minutes after the start;
  renewals and reconnects by someone who already joined until 15 minutes after the scheduled end
  (`siteConfig.consultation`).

Each booking's call gets a random 32-hex-character channel name (`consultation_calls`). The doctor
always joins as uid 1 and the patient as uid 2, baked into the token. Tokens last 10 minutes
(never past the hard stop), with privileges expiring at the same time. There's no recording.

Setup: create an Agora project with **App Certificate enabled** (one for Preview and one for
Production), and set `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`. Without them the endpoint answers
503. Requests must come from the site's own origin (`BETTER_AUTH_URL`, or the deployment's URL).

The call screen is `/consultations/<bookingId>` (patient or doctor only; anyone else 404, admins
403). Patients reach it from their booking page, doctors from **Join call** in their queue. It runs
the Agora Web SDK (`agora-rtc-sdk-ng`) client-side only (`components/consultation/`, loaded with
`ssr: false`, so the SDK isn't in any other page's JavaScript):

- **Lobby:** camera preview, microphone level and device choice, open any time before the call so
  people can test their setup; **Join** unlocks when the window opens. Camera and microphone start
  separately, so a blocked camera still allows an audio call.
- **In the call:** full screen, mobile first; mute (`setMuted`), camera off (`setEnabled`, which
  turns the camera light off), front/back camera on phones, network bars, "reconnecting" and
  "connection dropped" notices, and a tap-for-sound button when the browser blocks autoplay.
- **Tokens:** renewed on `token-privilege-will-expire`; if one expires anyway the call rejoins with
  a fresh token. If the server refuses (call ended or closed), the call leaves.
- **Leaving:** the Leave button, closing the tab or leaving the page turns the camera and microphone
  off and leaves the channel. The call also leaves at the hard stop.

Agora's SDK log upload stays off, and in production the browser console shows Agora errors only.

### Day-to-day

- **Edit doctors, hours and time off** with `npm run db:studio` (owner connection). Weekly hours
  (`doctor_availability`) are local wall-clock times in the doctor's `time_zone`; time off
  (`doctor_time_off`) is a UTC time range.
- **Consultation length:** every consultation is 30 minutes, for every doctor
  (`siteConfig.booking.consultationMinutes`). The database requires the same value
  (`doctors_minutes_check`), so changing it takes a new migration as well as the config.
- **Booking statuses:** `pending_payment` → `confirmed` (Paystack payment verified) or `cancelled`
  (patient, staff, or `system` when the 30-minute hold lapses). `confirmed` → `cancelled` (patient
  online until 2 h before, or staff; a paid booking is flagged for refund), `completed`
  (automatically 24 h after the end) or `no_show` (staff). `in_progress` (reserved for when both
  have joined the video call) → `completed`.
- **Patient data:** only name, email and optional phone are stored. The daily job clears them
  90 days after the appointment or cancellation (`siteConfig.booking.piiRetentionDays`).
