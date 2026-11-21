import "server-only";
import { eq } from "drizzle-orm";
import { isLiveHold } from "@/lib/booking/status";
import { createPaymentReference } from "@/lib/booking/tokens";
import type { Db } from "@/lib/db/client";
import { pgErrorCode, safeErrorSummary } from "@/lib/db/errors";
import { type BookingStatus, payments } from "@/lib/db/schema";
import { siteUrl } from "@/lib/origin";
import { siteConfig } from "@/lib/site";
import { initializeTransaction, PaystackError } from "./paystack";

/** Where Paystack sends the patient back to (it appends ?trxref=…&reference=…). */
export const PAYSTACK_CALLBACK_PATH = "/payments/paystack/callback";

export type CheckoutBooking = {
  id: string;
  status: BookingStatus;
  paymentExpiresAt: Date | null;
  feeCents: number;
  currency: string;
  patientEmail: string | null;
};

export type CheckoutResult = { ok: true; authorizationUrl: string } | { ok: false; reason: "not_payable" | "unavailable" };

/**
 * Start (or restart) Paystack checkout for an unpaid booking that still holds its slot: a new
 * `payments` row with a fresh reference, then Paystack's initialize. Each attempt gets its own row,
 * so a late success on an earlier attempt is still settled correctly.
 */
export async function startCheckout(db: Db, booking: CheckoutBooking, now = new Date()): Promise<CheckoutResult> {
  if (booking.status !== "pending_payment" || !isLiveHold(booking, now)) return { ok: false, reason: "not_payable" };
  if (!booking.patientEmail || booking.currency !== siteConfig.currency || booking.feeCents <= 0) return { ok: false, reason: "not_payable" };

  let payment: { id: string; reference: string } | undefined;
  for (let attempt = 0; attempt < 3 && !payment; attempt++) {
    try {
      [payment] = await db
        .insert(payments)
        .values({ bookingId: booking.id, reference: createPaymentReference(), amountMinor: booking.feeCents, currency: booking.currency })
        .returning({ id: payments.id, reference: payments.reference });
    } catch (error) {
      if (pgErrorCode(error) !== "23505") throw new Error(`Payment insert failed (${pgErrorCode(error) ?? "error"})`);
    }
  }
  if (!payment) throw new Error("Could not generate a unique payment reference");

  try {
    const { authorizationUrl } = await initializeTransaction({
      email: booking.patientEmail,
      amountMinor: booking.feeCents,
      currency: booking.currency,
      reference: payment.reference,
      callbackUrl: siteUrl(PAYSTACK_CALLBACK_PATH),
      bookingId: booking.id,
    });
    return { ok: true, authorizationUrl };
  } catch (error) {
    // PaystackError's message is just the HTTP status; anything else is summarised by type.
    console.error(`Paystack initialize failed for booking ${booking.id}: ${error instanceof PaystackError ? error.message : safeErrorSummary(error)}`);
    await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
    return { ok: false, reason: "unavailable" };
  }
}
