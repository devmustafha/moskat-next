import type { PaymentReviewReason, PaymentStatus } from "@/lib/db/schema";

/**
 * What to do with a payment once Paystack's verify endpoint has answered. Pure, so the rules are
 * unit-tested; lib/payments/settle.ts applies the result in one database transaction.
 *
 * Only Paystack's verify response (fetched by our server with the secret key) is trusted: never
 * the browser redirect, and never the webhook body on its own.
 */

/** The fields of Paystack's verify response that settlement relies on. */
export type VerifiedTransaction = {
  /** Paystack transaction status: "success", "failed", "abandoned", "reversed", "ongoing", "pending", … */
  status: string;
  /** Minor units (kobo). */
  amount: number;
  currency: string;
  reference: string;
  /** Paystack's transaction id. */
  id: string;
  paidAt: Date | null;
};

export type PaymentForSettlement = {
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  reference: string;
};

export type SettlementDecision =
  /** Payment verified and matches: confirm the booking (if it's still waiting for payment). */
  | { action: "confirm" }
  /** Money was taken but doesn't match what we asked for: hold for staff, don't confirm. */
  | { action: "review"; reason: Extract<PaymentReviewReason, "amount_mismatch" | "currency_mismatch"> }
  /** Paystack says this attempt failed or was abandoned. */
  | { action: "fail" }
  /** Nothing to change (already settled, still in progress, or not ours). */
  | { action: "none"; reason: "already_settled" | "in_progress" | "reference_mismatch" };

/** Paystack statuses that mean this attempt will not be paid. A later success still wins. */
const UNPAID_FINAL = new Set(["failed", "abandoned", "reversed"]);

/** Payment statuses that settlement never changes again (staff own them from here). */
const SETTLED = new Set<PaymentStatus>(["succeeded", "needs_review", "refunded"]);

export function decideSettlement(payment: PaymentForSettlement, verified: VerifiedTransaction): SettlementDecision {
  // Idempotency: Paystack retries webhooks, and the callback page settles too.
  if (SETTLED.has(payment.status)) return { action: "none", reason: "already_settled" };
  if (verified.reference !== payment.reference) return { action: "none", reason: "reference_mismatch" };

  if (verified.status === "success") {
    if (verified.currency.toUpperCase() !== payment.currency.toUpperCase()) return { action: "review", reason: "currency_mismatch" };
    if (!Number.isSafeInteger(verified.amount) || verified.amount !== payment.amountMinor) {
      return { action: "review", reason: "amount_mismatch" };
    }
    return { action: "confirm" };
  }
  if (UNPAID_FINAL.has(verified.status)) return payment.status === "failed" ? { action: "none", reason: "already_settled" } : { action: "fail" };
  return { action: "none", reason: "in_progress" };
}
