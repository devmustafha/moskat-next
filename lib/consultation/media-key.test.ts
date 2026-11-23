import { describe, expect, it } from "vitest";
import { base64ToBytes } from "./call-ui";
import { deriveMediaEncryption, MEDIA_ENCRYPTION_MODE } from "./media-key";

const master = "test-master-secret-0123456789-abcdefghijklmnop";
const channel = "0123456789abcdef0123456789abcdef";

describe("deriveMediaEncryption", () => {
  it("uses salted 256-bit AES-GCM", () => {
    expect(deriveMediaEncryption(master, channel).mode).toBe(MEDIA_ENCRYPTION_MODE);
    expect(MEDIA_ENCRYPTION_MODE).toBe("aes-256-gcm2");
  });

  it("gives both participants of a call the same secret and salt, every time", () => {
    expect(deriveMediaEncryption(master, channel)).toEqual(deriveMediaEncryption(master, channel));
  });

  it("gives every call its own secret and salt", () => {
    const a = deriveMediaEncryption(master, channel);
    const b = deriveMediaEncryption(master, "fedcba9876543210fedcba9876543210");
    expect(a.secret).not.toBe(b.secret);
    expect(a.salt).not.toBe(b.salt);
    expect(a.secret).not.toBe(a.salt);
  });

  it("depends on the master secret", () => {
    expect(deriveMediaEncryption(`${master}x`, channel).secret).not.toBe(deriveMediaEncryption(master, channel).secret);
  });

  it("makes a secret the Web SDK accepts (ASCII, at most 62 characters) and a 32-byte salt", () => {
    const { secret, salt } = deriveMediaEncryption(master, channel);
    expect(secret).toMatch(/^[A-Za-z0-9+/=]{44}$/);
    expect(base64ToBytes(salt)).toHaveLength(32);
  });

  it("refuses a short master secret", () => {
    expect(() => deriveMediaEncryption("too-short", channel)).toThrow();
  });
});

describe("base64ToBytes", () => {
  it("decodes base64 to the original bytes", () => {
    expect([...base64ToBytes(Buffer.from([0, 1, 127, 128, 255]).toString("base64"))]).toEqual([0, 1, 127, 128, 255]);
  });
});
