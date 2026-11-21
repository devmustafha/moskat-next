import { and, eq } from "drizzle-orm";
import { canTransition } from "@/lib/booking/status";
import { isWellFormedPaymentReference } from "@/lib/booking/tokens";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings, type PaymentReviewReason, payments, type PaymentStatus } from "@/lib/db/schema";
import { decideSettlement, type VerifiedTransaction } from "./settlement";

/**
 * Apply Paystack's verified result to a payment and its booking. Called by the webhook and by the
 * callback page; both may run for the same payment, at the same time, more than once.
 *
 * Idempotent: the payment row is locked (SELECT … FOR UPDATE) and re-read inside the transaction,
 * and a settled payment is never changed again. The booking moves pending_payment → confirmed in
 * the same transaction, conditionally on its current status, so a booking is confirmed at most once
 * and two payments can never both confirm it (the second is flagged for refund).
 *
 * `verify` is Paystack's verify endpoint in the app (lib/payments/paystack.ts); scripts inject a stub.
 */

export type Verifier = (reference: string) => Promise<VerifiedTransaction | null>;

export type SettleResult =
  /** Unknown or malformed reference. */
  | { outcome: "unknown_reference" }
  | {
      /**
       * - `confirmed`: this call confirmed the booking (send the confirmation email).
       * - `already_settled`: nothing changed; see `paymentStatus`.
       * - `pending`: Paystack hasn't completed the transaction (yet).
       * - `failed`: the attempt failed or was abandoned.
       * - `needs_review`: paid but not usable (mismatch, or the booking was no longer payable).
       */
      outcome: "confirmed" | "already_settled" | "pending" | "failed" | "needs_review";
      bookingId: string;
      paymentStatus: PaymentStatus;
      reviewReason?: PaymentReviewReason | null;
    };

const SETTLED_STATUSES = new Set<PaymentStatus>(["succeeded", "needs_review", "refunded"]);

export async function settlePayment(db: Db, reference: string, verify: Verifier, now = new Date()): Promise<SettleResult> {
  if (!isWellFormedPaymentReference(reference)) return { outcome: "unknown_reference" };

  const [known] = await db
    .select({ id: payments.id, bookingId: payments.bookingId, status: payments.status, reviewReason: payments.reviewReason })
    .from(payments)
    .where(eq(payments.reference, reference))
    .limit(1);
  if (!known) return { outcome: "unknown_reference" };
  // Settled already: answer without calling Paystack again (webhook retries, page reloads).
  if (SETTLED_STATUSES.has(known.status)) {
    return { outcome: "already_settled", bookingId: known.bookingId, paymentStatus: known.status, reviewReason: known.reviewReason };
  }

  // Ask Paystack outside the transaction, so no row lock is held during a network call.
  const verified = await verify(reference);
  if (!verified) return { outcome: "pending", bookingId: known.bookingId, paymentStatus: known.status };

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select({
        id: payments.id,
        bookingId: payments.bookingId,
        status: payments.status,
        reviewReason: payments.reviewReason,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        reference: payments.reference,
      })
      .from(payments)
      .where(eq(payments.id, known.id))
      .for("update");

    const base = { bookingId: payment.bookingId };
    const decision = decideSettlement(payment, verified);
    const verifiedFields = { providerTransactionId: verified.id || null, paidAt: verified.paidAt ?? now };

    switch (decision.action) {
      case "none":
        return {
          ...base,
          outcome: decision.reason === "in_progress" ? "pending" : "already_settled",
          paymentStatus: payment.status,
          reviewReason: payment.reviewReason,
        };

      case "fail":
        await tx.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
        return { ...base, outcome: "failed", paymentStatus: "failed" };

      case "review":
        await tx
          .update(payments)
          .set({ status: "needs_review", reviewReason: decision.reason, ...verifiedFields })
          .where(eq(payments.id, payment.id));
        return { ...base, outcome: "needs_review", paymentStatus: "needs_review", reviewReason: decision.reason };

      case "confirm": {
        // canTransition("pending_payment", "confirmed"); the WHERE re-checks it against the row as
        // it is now, so a booking that expired, was cancelled or was paid by another attempt stays put.
        const confirmed = canTransition("pending_payment", "confirmed")
          ? await tx
              .update(bookings)
              .set({ status: "confirmed" })
              .where(and(eq(bookings.id, payment.bookingId), eq(bookings.status, "pending_payment")))
              .returning({ id: bookings.id })
          : [];
        if (confirmed.length === 0) {
          // Paid, but the booking can't take it: flag for a refund.
          await tx
            .update(payments)
            .set({ status: "needs_review", reviewReason: "booking_not_payable", ...verifiedFields })
            .where(eq(payments.id, payment.id));
          return { ...base, outcome: "needs_review", paymentStatus: "needs_review", reviewReason: "booking_not_payable" };
        }
        await tx
          .update(payments)
          .set({ status: "succeeded", reviewReason: null, ...verifiedFields })
          .where(eq(payments.id, payment.id));
        return { ...base, outcome: "confirmed", paymentStatus: "succeeded" };
      }
    }
  });
}
