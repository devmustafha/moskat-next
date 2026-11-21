/**
 * Concurrency check for the booking flow: fires 20 simultaneous bookings (unpaid holds) for the
 * same slot, each on its own connection, and expects exactly one to succeed. Then removes them and
 * the temporary patient account it books with.
 *
 *   DATABASE_URL=… npx tsx scripts/check-double-booking.ts [doctor-slug]
 *
 * Use a development database only: it writes (and deletes) a test account and test bookings.
 */
import { eq, inArray } from "drizzle-orm";
import type { PatientSession } from "@/lib/auth/session";
import { findBookableDoctor, loadSlotQuery } from "@/lib/booking/availability";
import { createBooking } from "@/lib/booking/create";
import { listSlots } from "@/lib/booking/slots";
import { connect, withDb } from "@/lib/db/client";
import { consultationBookings, users } from "@/lib/db/schema";

try {
  process.loadEnvFile();
} catch {}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL.");

const ATTEMPTS = 20;
const slug = process.argv[2] ?? "arjun-mehta";
const run = Date.now().toString(36);

const { startsAt, patient } = await withDb(url, async (db) => {
  const doctor = await findBookableDoctor(db, slug);
  if (!doctor) throw new Error(`No active doctor "${slug}"`);
  const [first] = listSlots(await loadSlotQuery(db, doctor, new Date()));
  if (!first) throw new Error("Doctor has no free slots");
  const [user] = await db
    .insert(users)
    .values({ name: "Concurrency Test", email: `check-double-booking-${run}@example.test`, role: "patient" })
    .returning({ id: users.id, name: users.name, email: users.email });
  const patient: PatientSession = { ...user, role: "patient" };
  return { startsAt: first.start.toISOString(), patient };
});

// Open every connection first (retrying slow connects), then fire all bookings at once.
async function connectWithRetry(tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await connect(url as string);
    } catch (error) {
      if (attempt >= tries) throw error;
    }
  }
}
const connections = await Promise.all(Array.from({ length: ATTEMPTS }, () => connectWithRetry()));

const results = await Promise.all(
  connections.map(({ db }, i) =>
    createBooking(db, { doctorSlug: slug, startsAt, name: `Concurrency Test ${i}`, phone: "", consent: true }, patient),
  ),
);
await Promise.all(connections.map(({ close }) => close().catch(() => {})));

const succeeded = results.filter((result) => result.ok);
const reasons = results.flatMap((result) => (result.ok ? [] : [result.reason]));
console.log(`slot ${startsAt}: ${succeeded.length} succeeded, ${reasons.length} refused`, Object.groupBy(reasons, (r) => r));

const ids = succeeded.flatMap((result) => (result.ok ? [result.booking.id] : []));
await withDb(url, async (db) => {
  if (ids.length) await db.delete(consultationBookings).where(inArray(consultationBookings.id, ids));
  await db.delete(users).where(eq(users.id, patient.id));
});

if (succeeded.length !== 1) {
  console.error("FAIL: expected exactly one booking");
  process.exit(1);
}
console.log("PASS: exactly one booking was created");
