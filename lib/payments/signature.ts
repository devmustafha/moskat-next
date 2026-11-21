import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack signs each webhook with `x-paystack-signature`: the hex HMAC-SHA512 of the raw request
 * body, keyed with the secret key. Check it against the exact bytes received, before parsing.
 * Never throws; any malformed input is simply "not valid".
 */
export function isValidPaystackSignature(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature || !secretKey) return false;
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
