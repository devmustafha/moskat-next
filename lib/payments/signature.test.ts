import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidPaystackSignature } from "./signature";

const secret = "sk_test_example_secret";
const body = JSON.stringify({ event: "charge.success", data: { reference: "MSK-PAY-ABC", amount: 2500000 } });
const sign = (payload: string, key = secret) => createHmac("sha512", key).update(payload).digest("hex");

describe("isValidPaystackSignature", () => {
  it("accepts the HMAC-SHA512 of the raw body", () => {
    expect(isValidPaystackSignature(body, sign(body), secret)).toBe(true);
    expect(isValidPaystackSignature(body, sign(body).toUpperCase(), secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(isValidPaystackSignature(body.replace("2500000", "100"), sign(body), secret)).toBe(false);
    // Re-serialised JSON is a different byte string, so the raw body must be checked.
    expect(isValidPaystackSignature(JSON.stringify(JSON.parse(body), null, 2), sign(body), secret)).toBe(false);
  });

  it("rejects a signature made with another key", () => {
    expect(isValidPaystackSignature(body, sign(body, "sk_test_other"), secret)).toBe(false);
  });

  it("rejects missing, malformed or wrong-length signatures without throwing", () => {
    expect(isValidPaystackSignature(body, null, secret)).toBe(false);
    expect(isValidPaystackSignature(body, "", secret)).toBe(false);
    expect(isValidPaystackSignature(body, "not-hex", secret)).toBe(false);
    expect(isValidPaystackSignature(body, sign(body).slice(0, 64), secret)).toBe(false);
    expect(isValidPaystackSignature(body, `${sign(body)}00`, secret)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isValidPaystackSignature(body, sign(body, ""), "")).toBe(false);
  });
});
