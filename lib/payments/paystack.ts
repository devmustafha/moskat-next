import "server-only";
import type { VerifiedTransaction } from "./settlement";

/**
 * Paystack's REST API (https://api.paystack.co, Bearer secret key), from Paystack's OpenAPI spec
 * (github.com/PaystackHQ/openapi): POST /transaction/initialize and GET /transaction/verify/{reference}.
 *
 * Errors carry the HTTP status only. Response bodies are never logged or put in errors: they hold
 * the customer's email and card details (BIN, last 4).
 */

const API = "https://api.paystack.co";
const TIMEOUT_MS = 10_000;

export class PaystackError extends Error {
  constructor(readonly status: number) {
    super(`Paystack returned ${status}`);
    this.name = "PaystackError";
  }
}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Payments not configured (PAYSTACK_SECRET_KEY is not set)");
  return key;
}

type Envelope = { status?: unknown; data?: unknown };

async function request(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<{ httpStatus: number; envelope: Envelope | null }> {
  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers: { authorization: `Bearer ${secretKey()}`, ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  let envelope: Envelope | null = null;
  try {
    envelope = (await response.json()) as Envelope;
  } catch {
    await response.body?.cancel().catch(() => {});
  }
  return { httpStatus: response.status, envelope };
}

export type InitializedTransaction = { authorizationUrl: string; reference: string };

/**
 * Start a checkout. `amountMinor` is kobo. Only the account email and our booking id go to
 * Paystack: no doctor, specialty or other detail that could reveal why the patient is paying.
 */
export async function initializeTransaction(input: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  bookingId: string;
}): Promise<InitializedTransaction> {
  const { httpStatus, envelope } = await request("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      // The spec types metadata as a stringified JSON object.
      metadata: JSON.stringify({ booking_id: input.bookingId }),
    },
  });
  const data = envelope?.data as { authorization_url?: unknown; reference?: unknown } | undefined;
  const url = typeof data?.authorization_url === "string" ? data.authorization_url : "";
  // Only ever redirect the patient to Paystack's own HTTPS checkout.
  if (httpStatus >= 300 || envelope?.status !== true || !/^https:\/\/([a-z0-9-]+\.)*paystack\.(com|co)\//i.test(url)) {
    throw new PaystackError(httpStatus);
  }
  return { authorizationUrl: url, reference: typeof data?.reference === "string" ? data.reference : input.reference };
}

/**
 * Paystack's own record of a transaction, or null if Paystack doesn't know the reference.
 * This (fetched with our secret key) is the only thing that marks a payment as paid.
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  const { httpStatus, envelope } = await request(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  if (httpStatus === 400 || httpStatus === 404) return null;
  if (httpStatus >= 300 || envelope?.status !== true) throw new PaystackError(httpStatus);

  const data = envelope.data as Record<string, unknown> | undefined;
  if (!data || typeof data.status !== "string" || typeof data.reference !== "string") throw new PaystackError(httpStatus);
  const paidAt = typeof data.paid_at === "string" ? new Date(data.paid_at) : null;
  return {
    status: data.status,
    amount: typeof data.amount === "number" ? data.amount : Number.NaN,
    currency: typeof data.currency === "string" ? data.currency : "",
    reference: data.reference,
    id: data.id === undefined || data.id === null ? "" : String(data.id),
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
  };
}
