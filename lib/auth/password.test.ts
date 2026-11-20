import { describe, expect, it } from "vitest";
import { createPasswordHasher, needsRehash } from "./password";

const pepper = "test-pepper-0123456789abcdefghijklmnop";
const hasher = createPasswordHasher(pepper);

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hasher.hash("correct horse battery");
    expect(hash).toMatch(/^scrypt\$16384\$16\$1\$[\w-]+\$[\w-]+$/);
    expect(await hasher.verify({ hash, password: "correct horse battery" })).toBe(true);
    expect(await hasher.verify({ hash, password: "correct horse batterY" })).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hasher.hash("same password")).not.toBe(await hasher.hash("same password"));
  });

  it("fails without the same pepper", async () => {
    const hash = await hasher.hash("correct horse battery");
    const other = createPasswordHasher("another-pepper-0123456789abcdefghijkl");
    expect(await other.verify({ hash, password: "correct horse battery" })).toBe(false);
  });

  it("treats equivalent Unicode forms as the same password", async () => {
    const hash = await hasher.hash("café au lait 12");
    expect(await hasher.verify({ hash, password: "café au lait 12" })).toBe(true);
  });

  it("rejects malformed or tampered hashes without throwing", async () => {
    const hash = await hasher.hash("correct horse battery");
    const parts = hash.split("$");
    for (const bad of [
      "",
      "not-a-hash",
      hash.replace("scrypt", "bcrypt"),
      [parts[0], 2 ** 20, ...parts.slice(2)].join("$"), // too expensive
      [parts[0], 1000, ...parts.slice(2)].join("$"), // N not a power of two
      [...parts.slice(0, 5), "AAAA"].join("$"), // wrong key length
    ]) {
      expect(await hasher.verify({ hash: bad, password: "correct horse battery" })).toBe(false);
    }
  });

  it("requires a long pepper", () => {
    expect(() => createPasswordHasher(undefined)).toThrow();
    expect(() => createPasswordHasher("short")).toThrow();
  });

  it("flags weaker or unreadable hashes for rehashing", async () => {
    expect(needsRehash(await hasher.hash("correct horse battery"))).toBe(false);
    expect(needsRehash("scrypt$8192$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(43))).toBe(true);
    // The previous (Workers Free plan) parameters are weaker than the current ones.
    expect(needsRehash("scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(43))).toBe(true);
    expect(needsRehash("garbage")).toBe(true);
  });
});
