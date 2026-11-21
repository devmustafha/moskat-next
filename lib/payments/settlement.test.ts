import { describe, expect, it } from "vitest";
import { decideSettlement, type PaymentForSettlement, type VerifiedTransaction } from "./settlement";

const payment: PaymentForSettlement = { status: "initialized", amountMinor: 2_500_000, currency: "NGN", reference: "MSK-PAY-ABC123" };
const verified: VerifiedTransaction = {
  status: "success",
  amount: 2_500_000,
  currency: "NGN",
  reference: "MSK-PAY-ABC123",
  id: "4099260516",
  paidAt: new Date("2026-11-20T10:00:00Z"),
};

describe("decideSettlement", () => {
  it("confirms a verified success that matches the amount and currency", () => {
    expect(decideSettlement(payment, verified)).toEqual({ action: "confirm" });
    // A failed or abandoned attempt that was later completed still confirms.
    expect(decideSettlement({ ...payment, status: "failed" }, verified)).toEqual({ action: "confirm" });
  });

  it("is idempotent: a settled payment is never changed again", () => {
    for (const status of ["succeeded", "needs_review", "refunded"] as const) {
      expect(decideSettlement({ ...payment, status }, verified)).toEqual({ action: "none", reason: "already_settled" });
      expect(decideSettlement({ ...payment, status }, { ...verified, status: "failed" })).toEqual({ action: "none", reason: "already_settled" });
    }
  });

  it("holds a success with the wrong amount for review", () => {
    expect(decideSettlement(payment, { ...verified, amount: 2_499_999 })).toEqual({ action: "review", reason: "amount_mismatch" });
    expect(decideSettlement(payment, { ...verified, amount: 25_000 })).toEqual({ action: "review", reason: "amount_mismatch" });
    expect(decideSettlement(payment, { ...verified, amount: Number.NaN })).toEqual({ action: "review", reason: "amount_mismatch" });
  });

  it("holds a success in another currency for review", () => {
    expect(decideSettlement(payment, { ...verified, currency: "USD" })).toEqual({ action: "review", reason: "currency_mismatch" });
    expect(decideSettlement(payment, { ...verified, currency: "ngn" })).toEqual({ action: "confirm" });
  });

  it("marks failed, abandoned and reversed attempts as failed, once", () => {
    for (const status of ["failed", "abandoned", "reversed"]) {
      expect(decideSettlement(payment, { ...verified, status })).toEqual({ action: "fail" });
      expect(decideSettlement({ ...payment, status: "failed" }, { ...verified, status })).toEqual({ action: "none", reason: "already_settled" });
    }
  });

  it("leaves in-progress transactions alone", () => {
    for (const status of ["ongoing", "pending", "processing", "queued"]) {
      expect(decideSettlement(payment, { ...verified, status })).toEqual({ action: "none", reason: "in_progress" });
    }
  });

  it("ignores a verify response for a different reference", () => {
    expect(decideSettlement(payment, { ...verified, reference: "MSK-PAY-OTHER" })).toEqual({ action: "none", reason: "reference_mismatch" });
  });
});
