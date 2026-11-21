/**
 * Payment settlement checks against a real database, with Paystack's verify endpoint stubbed
 * (so no Paystack account or network is needed):
 *
 * 1. 10 simultaneous settlements of the same paid reference, each on its own connection (like
 *    Paystack retrying a webhook while the patient lands on the callback page): exactly one
 *    confirms the booking; the payment is `succeeded` once; replays change nothing.
 * 2. A success whose amount doesn't match: flagged for review, booking left unpaid.
 * 3. A second, later payment for a booking that's already paid: flagged for refund.
 * 4. Cancelling a paid booking: cancelled, and its payment flagged for refund.
 * 5. A payment for a hold that lapsed and was released: flagged for refund, booking stays cancelled.
 *
 *   DATABASE_URL=… npx tsx scripts/check-payments.ts [doctor-slug]
 *
 * Use a development database only: it writes (and deletes) a test account, bookings and payments.
 */
import { eq, inArray } from "drizzle-orm";
import type { PatientSession } from "@/lib/auth/session";
import { findBookableDoctor, loadSlotQuery } from "@/lib/booking/availability";
import { createBooking, releaseHold } from "@/lib/booking/create";
import { cancelBooking } from "@/lib/booking/manage";
import { listSlots } from "@/lib/booking/slots";
import { createPaymentReference } from "@/lib/booking/tokens";
import { connect, type Db, withDb } from "@/lib/db/client";
import { consultationBookings as bookings, payments, users } from "@/lib/db/schema";
import { settlePayment, type Verifier } from "@/lib/payments/settle";
import type { VerifiedTransaction } from "@/lib/payments/settlement";

try {
  process.loadEnvFile();
} catch {}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL.");

const CONCURRENT = 10;
const slug = process.argv[2] ?? "arjun-mehta";
const run = Date.now().toString(36);

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass || !detail ? "" : `: ${detail}`}`);
}

/** A stub of Paystack's verify response for `payment`, optionally altered. */
function stub(payment: { reference: string; amountMinor: number; currency: string }, change: Partial<VerifiedTransaction> = {}): Verifier {
  return async (reference) => ({
    status: "success",
    amount: payment.amountMinor,
    currency: payment.currency,
    reference,
    id: `test-${reference}`,
    paidAt: new Date(),
    ...change,
  });
}

async function addPayment(db: Db, booking: { id: string; feeCents: number; currency: string }) {
  const [row] = await db
    .insert(payments)
    .values({ bookingId: booking.id, reference: createPaymentReference(), amountMinor: booking.feeCents, currency: booking.currency })
    .returning({ id: payments.id, reference: payments.reference, amountMinor: payments.amountMinor, currency: payments.currency });
  return row;
}

async function state(db: Db, bookingId: string) {
  const [booking] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId));
  const rows = await db
    .select({ reference: payments.reference, status: payments.status, reviewReason: payments.reviewReason })
    .from(payments)
    .where(eq(payments.bookingId, bookingId));
  return { status: booking?.status, payments: rows };
}

const created: string[] = [];
let patientId: string | null = null;

try {
  await withDb(url, async (db) => {
    const doctor = await findBookableDoctor(db, slug);
    if (!doctor) throw new Error(`No active doctor "${slug}"`);
    const slots = listSlots(await loadSlotQuery(db, doctor, new Date()));
    if (slots.length < 4) throw new Error("Doctor needs at least 4 free slots");

    const [user] = await db
      .insert(users)
      .values({ name: "Payment Check", email: `check-payments-${run}@example.test`, role: "patient" })
      .returning({ id: users.id, name: users.name, email: users.email });
    patientId = user.id;
    const patient: PatientSession = { ...user, role: "patient" };

    async function book(slot: (typeof slots)[number]) {
      const result = await createBooking(db, { doctorSlug: slug, startsAt: slot.start.toISOString(), name: "Payment Check", phone: "", consent: true }, patient);
      if (!result.ok) throw new Error(`Booking failed: ${result.reason}`);
      created.push(result.booking.id);
      return result.booking;
    }

    // 1. Concurrent settlement of one paid reference --------------------------------------------
    const a = await book(slots[0]);
    const paymentA = await addPayment(db, a);
    const connections = await Promise.all(Array.from({ length: CONCURRENT }, () => connect(url)));
    const results = await Promise.all(connections.map(({ db: c }) => settlePayment(c, paymentA.reference, stub(paymentA))));
    await Promise.all(connections.map(({ close }) => close().catch(() => {})));
    const outcomes = Object.groupBy(results, (r) => r.outcome);
    check(`${CONCURRENT} concurrent settlements: exactly one confirms`, outcomes.confirmed?.length === 1, JSON.stringify(Object.keys(outcomes)));
    check("…the others report already settled", outcomes.already_settled?.length === CONCURRENT - 1);
    let s = await state(db, a.id);
    check("…booking is confirmed", s.status === "confirmed", s.status);
    check("…payment succeeded once", s.payments.length === 1 && s.payments[0].status === "succeeded", JSON.stringify(s.payments));

    const replay = await settlePayment(db, paymentA.reference, async () => {
      throw new Error("verify must not be called for a settled payment");
    });
    check("Replay of a settled payment changes nothing (and doesn't call Paystack)", replay.outcome === "already_settled");

    // 2. Amount mismatch -------------------------------------------------------------------------
    const b = await book(slots[1]);
    const paymentB = await addPayment(db, b);
    const mismatch = await settlePayment(db, paymentB.reference, stub(paymentB, { amount: paymentB.amountMinor - 100 }));
    s = await state(db, b.id);
    check(
      "Wrong amount: flagged for review, booking still unpaid",
      mismatch.outcome === "needs_review" && s.status === "pending_payment" && s.payments[0].reviewReason === "amount_mismatch",
      `${mismatch.outcome} ${s.status} ${s.payments[0]?.reviewReason}`,
    );

    // 3. A second payment for a booking that's already paid --------------------------------------
    const paymentA2 = await addPayment(db, a);
    const second = await settlePayment(db, paymentA2.reference, stub(paymentA2));
    s = await state(db, a.id);
    const a2 = s.payments.find((p) => p.reference === paymentA2.reference);
    check(
      "Second payment for a paid booking: flagged for refund",
      second.outcome === "needs_review" && a2?.reviewReason === "booking_not_payable" && s.status === "confirmed",
      `${second.outcome} ${a2?.reviewReason}`,
    );

    // 4. Cancelling a paid booking ---------------------------------------------------------------
    const cancelled = await cancelBooking(db, a.id, "confirmed", { cancelledAt: new Date(), cancelledBy: "patient" });
    s = await state(db, a.id);
    const a1 = s.payments.find((p) => p.reference === paymentA.reference);
    check(
      "Cancelling a paid booking: cancelled, payment flagged for refund",
      cancelled?.refundDue === true && s.status === "cancelled" && a1?.status === "needs_review" && a1.reviewReason === "cancelled_after_payment",
      `${JSON.stringify(cancelled)} ${s.status} ${a1?.status}/${a1?.reviewReason}`,
    );

    // 5. Payment arriving after the hold was released --------------------------------------------
    const c = await book(slots[2]);
    const paymentC = await addPayment(db, c);
    await releaseHold(db, c.id);
    const late = await settlePayment(db, paymentC.reference, stub(paymentC));
    s = await state(db, c.id);
    check(
      "Payment after the hold was released: flagged for refund, booking stays cancelled",
      late.outcome === "needs_review" && s.status === "cancelled" && s.payments[0].reviewReason === "booking_not_payable",
      `${late.outcome} ${s.status}`,
    );

    // Unknown / malformed references never touch the database or Paystack.
    const unknown = await settlePayment(db, "not-a-reference", async () => {
      throw new Error("verify must not be called");
    });
    check("Malformed reference is ignored", unknown.outcome === "unknown_reference");
  });
} finally {
  // Remove everything this run created (as the owner role; the website role can't delete these).
  await withDb(url, async (db) => {
    if (created.length) {
      await db.delete(payments).where(inArray(payments.bookingId, created));
      await db.delete(bookings).where(inArray(bookings.id, created));
    }
    if (patientId) await db.delete(users).where(eq(users.id, patientId));
  }).catch((error) => console.error(`Cleanup failed (${(error as { code?: string }).code ?? "error"}): remove check-payments-${run} by hand.`));
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll payment checks passed");
process.exit(failures ? 1 : 0);
