# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running commands

- Non-interactive shells resolve the system Node (22.22.1), which is too old. Prefix `npm run dev`/`build`/`start` with `. ~/.nvm/nvm.sh && nvm use &&` (Node 22.23.5 via `.nvmrc`).
- `npm run typecheck` and `npm test` (Vitest, pure modules in `lib/**/*.test.ts` only) are the automated checks. There is no linter. `npm run build` also type-checks. After auth or access changes, run `npm run auth:check -- --base-url <local or preview URL>` (see README: Authentication).
- Database scripts (`db:*`, `auth:*`, see README: Database) read `DATABASE_URL` from `.env`. Never point them at the Neon `main` branch unless releasing.
- On high-latency connections (like this machine's to Neon in us-east-2), Node's 250 ms per-address connect timeout makes connections fail with `ETIMEDOUT` while psql works. `lib/db/connect-timeout.ts` raises it to 10 s; keep importing it from anything that opens a database connection.
- `.env` holds owner credentials. Never print it or a connection string unmasked. Don't `source` it in the shell (the `&` in Neon URLs breaks it); Next.js loads it for the app, and `process.loadEnvFile()` loads it for the configs and scripts.

## Runtime: Next.js on Vercel

- This is a standard Next.js 16 App Router app (`next` pinned exactly), deployed to Vercel on the Node.js runtime. Middleware lives in `proxy.ts` (Next.js 16's name for it).
- `forbidden()` needs `experimental.authInterrupts` in `next.config.ts`; keep it.
- Every route renders on demand (the header reads cookies). Don't add `"use cache"`, `revalidate` or static generation to anything that shows availability, bookings or account data.
- The app's database access goes through the pool in `lib/db/server.ts` (`getDb()` in pages, `runWithDb()` in actions and route handlers). Scripts use `lib/db/client.ts` with their own connection.
- On Vercel, `DATABASE_URL` is Neon's **pooled** string as `moskat_web`. Migrations and scripts use the **direct** (no `-pooler`) owner string.
- Environment variables are listed in `.env.example`. Secrets live in `.env` locally and in Vercel's environment variables; never in code or `vercel.json`.
- The daily job is `app/api/cron/maintenance/route.ts`, scheduled in `vercel.json` and protected by `CRON_SECRET`.
- Email goes through `lib/email/resend.ts`. Never log message contents or Resend response bodies (they hold patient details).
- The visitor's IP comes from `x-forwarded-for` (set by Vercel). Rate limits key on it.

## Conventions

- Tailwind CSS v4 is configured in CSS (`@theme` in `app/globals.css`, via `@tailwindcss/postcss`). Don't create `tailwind.config.js`.
- Style with the design tokens (`text-ink`, `text-h2`, `rounded-card`, `container-site`, …) and the primitives in `components/ui/`, not raw Tailwind colours, sizes or radii. `/styleguide` (dev only) shows them all.
- When adding a token to `@theme`, also register it in the `extendTailwindMerge` config in `lib/utils.ts`; otherwise `cn()` silently drops classes it thinks conflict (e.g. `text-small` vs `text-white`).
- Site branding (name, tagline, description) comes from `siteConfig` in `lib/site.ts`; don't hard-code it in components.
- `lucide-react` is pinned to 0.577.0. Upgrade to v1 only deliberately: there every icon is a client component, which ships icon JS to the browser.
- Photos are Unsplash CDN URLs rendered with `components/ui/photo.tsx` (srcset via CDN params), not `next/image`. Sample content lives in `lib/data/` and `lib/db/seed-data.ts`, contact details/hours in `siteConfig`; all are placeholders.

## Database and booking

- Keep the schema small. Don't add medical records, prescriptions, insurance, billing history, reviews or multi-branch support without being asked.
- Migrations are additive and never edited once applied. Release order: migrate the preview branch → test the Vercel preview → migrate `main` → deploy production.
- Double-booking is prevented by the `bookings_no_overlap` exclusion constraint, not app code. A new slot-holding status must be added to both that constraint and `slotHoldingStatuses`. Always re-check the requested slot on the server; never trust the client's.
- Free slots are calculated from weekly hours, not stored. Weekly hours are wall-clock times in the doctor's `time_zone`; booked instants are `timestamptz`.
- Money is integer cents plus a currency code, never floats. Bookings copy the fee at booking time.
- Bookings start `confirmed`. Add `pending` only when payment or staff review exists. Change status only through `canTransition`.
- The website's DB role (`moskat_app`) can't run DDL and can only delete from `sessions`, `verifications`, `rate_limits` and `doctor_availability` (a doctor replacing their hours deletes rules that never took effect; past rules get `effective_until`). New tables need explicit grants in their migration.
- Auth tables (`lib/db/auth-schema.ts`) use Better Auth's field names as TypeScript keys; don't rename them. Re-check them against `npx auth@latest generate` when upgrading Better Auth or adding a plugin.
- `PASSWORD_PEPPER` must never change for an environment that has accounts. The scrypt parameters in `lib/auth/password.ts` may be raised (never lowered); old hashes keep verifying.
- Every protected page and server action calls a `require*` guard from `lib/auth/session.ts` itself, and data functions take the guard's result, never a user id from params or form data. A check in a layout alone protects nothing (layouts don't re-run on client navigation; actions are separate endpoints).
- Rate limits are counted in Postgres (`rate_limits`): Better Auth's database storage for sign-in, and `lib/booking/rate-limit.ts` for bookings. In-memory counters don't work across Vercel's instances.
- Admin plugin endpoints don't enforce the minimum password length; the `hooks.before` in `lib/auth/auth.ts` does. Keep it when adding admin password flows.
- Vercel's request logs record full paths, including `/bookings/<token>` links. Keep log retention short and don't forward them to third parties without excluding those.
- Patient data stays minimal: name, email, optional phone, consent time. No free-text reason or clinical fields. Store only the hash of manage tokens. Never log form values or `error.message` from database errors (Drizzle includes query parameters, Postgres `detail` echoes rows); log booking ids and `safeErrorSummary(error)`.
