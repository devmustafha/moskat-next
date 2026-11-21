import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { sendPaidConfirmation } from "@/lib/payments/notify";
import { PaystackError, verifyTransaction } from "@/lib/payments/paystack";
import { settlePayment } from "@/lib/payments/settle";
import { isValidPaystackSignature } from "@/lib/payments/signature";

/**
 * Paystack webhook (set https://<host>/api/webhooks/paystack in the Paystack dashboard, per mode).
 *
 * 1. The x-paystack-signature header must be the HMAC-SHA512 of the raw body with our secret key.
 * 2. Only `charge.success` is handled. Its body is just a hint: the payment is settled from
 *    Paystack's verify endpoint (settlePayment), never from the webhook's own amount or status.
 * 3. Idempotent: Paystack retries, and may send the same event more than once.
 *
 * Responds 200 once handled or deliberately ignored, 401 for a bad signature, and 500 on a
 * temporary failure so Paystack retries. Never logs the body (it holds the customer's email and card details).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = () => new Response(null, { status: 200 });

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  const rawBody = await request.text();
  if (!isValidPaystackSignature(rawBody, request.headers.get("x-paystack-signature"), secretKey)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: unknown; data?: { reference?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return ok();
  }
  if (event.event !== "charge.success") return ok();
  const reference = event.data?.reference;
  if (typeof reference !== "string") return ok();

  try {
    const result = await runWithDb(async (db) => {
      const settled = await settlePayment(db, reference, verifyTransaction);
      if (settled.outcome === "confirmed") await sendPaidConfirmation(db, settled.bookingId);
      return settled;
    });
    // Ids and outcomes only.
    if (result.outcome === "unknown_reference") console.warn("paystack webhook: unknown reference");
    else console.log(`paystack webhook: booking ${result.bookingId} ${result.outcome}${"reviewReason" in result && result.reviewReason ? ` (${result.reviewReason})` : ""}`);
    return ok();
  } catch (error) {
    console.error(`paystack webhook failed: ${error instanceof PaystackError ? error.message : safeErrorSummary(error)}`);
    return new Response("Temporary failure", { status: 500 });
  }
}
