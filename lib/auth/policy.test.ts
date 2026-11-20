import { describe, expect, it } from "vitest";
import { isPastAbsoluteLifetime, safeNext } from "./policy";

describe("safeNext", () => {
  it("accepts paths on this site", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/doctors/arjun-mehta/book?x=1")).toBe("/doctors/arjun-mehta/book?x=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const next of [
      null,
      undefined,
      "",
      "account",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      `/${"a".repeat(600)}`,
    ]) {
      expect(safeNext(next)).toBeNull();
    }
  });
});

describe("isPastAbsoluteLifetime", () => {
  const signedIn = new Date("2026-11-19T08:00:00Z");

  it("allows sessions up to 12 hours old", () => {
    expect(isPastAbsoluteLifetime(signedIn, new Date("2026-11-19T19:59:00Z"))).toBe(false);
    expect(isPastAbsoluteLifetime(signedIn, new Date("2026-11-19T20:00:00Z"))).toBe(false);
  });

  it("ends sessions older than 12 hours", () => {
    expect(isPastAbsoluteLifetime(signedIn, new Date("2026-11-19T20:00:01Z"))).toBe(true);
  });
});
