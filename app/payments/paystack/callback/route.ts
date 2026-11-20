import { NextResponse } from "next/server";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { sendPaidConfirmation } from "@/lib/payments/notify";
import { PaystackError, verifyTransaction } from "@/lib/payments/paystack";
import { settlePayment } from "@/lib/payments/settle";

/**
 * Where Paystack sends the patient after checkout (…?trxref=<ref>&reference=<ref>). The redirect
 * itself proves nothing: we verify the transaction with Paystack server-side and settle it (the
 * same idempotent path as the webhook), then show the booking in the patient's account.
 * The booking page itself checks the patient's session; nothing here reveals booking details.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentFlag = "success" | "pending" | "failed" | "review";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "";

  let bookingId: string | null = null;
  let flag: PaymentFlag = "pending";
  try {
    const result = await runWithDb(async (db) => {
      const settled = await settlePayment(db, reference, verifyTransaction);
      if (settled.outcome === "confirmed") await sendPaidConfirmation(db, settled.bookingId);
      return settled;
    });
    if (result.outcome !== "unknown_reference") {
      bookingId = result.bookingId;
      flag =
        result.paymentStatus === "succeeded"
          ? "success"
          : result.paymentStatus === "needs_review" || result.paymentStatus === "refunded"
            ? "review"
            : result.outcome === "failed" || result.paymentStatus === "failed"
              ? "failed"
              : "pending";
    }
  } catch (error) {
    // The webhook will still settle it; show "confirming" meanwhile.
    console.error(`paystack callback failed: ${error instanceof PaystackError ? error.message : safeErrorSummary(error)}`);
  }

  const target = bookingId ? `/account/bookings/${bookingId}?payment=${flag}` : "/account/bookings";
  const response = NextResponse.redirect(new URL(target, url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
