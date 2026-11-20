import { describe, expect, it } from "vitest";
import { canTransition, isLiveHold } from "./status";

describe("canTransition", () => {
  it("allows the documented changes", () => {
    expect(canTransition("pending_payment", "confirmed")).toBe(true);
    expect(canTransition("pending_payment", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("completed", "no_show")).toBe(true);
  });

  it("never skips payment or reopens a booking", () => {
    expect(canTransition("pending_payment", "completed")).toBe(false);
    expect(canTransition("pending_payment", "no_show")).toBe(false);
    expect(canTransition("confirmed", "pending_payment")).toBe(false);
    expect(canTransition("cancelled", "pending_payment")).toBe(false);
  });

  it("treats cancelled and no-show as final", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("no_show", "completed")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });
});

describe("isLiveHold", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  const later = new Date("2026-11-20T10:05:00Z");
  const earlier = new Date("2026-11-20T09:55:00Z");

  it("holds the slot while an unpaid hold is still valid", () => {
    expect(isLiveHold({ status: "pending_payment", paymentExpiresAt: later }, now)).toBe(true);
  });

  it("releases a lapsed or undated unpaid hold", () => {
    expect(isLiveHold({ status: "pending_payment", paymentExpiresAt: earlier }, now)).toBe(false);
    expect(isLiveHold({ status: "pending_payment", paymentExpiresAt: now }, now)).toBe(false);
    expect(isLiveHold({ status: "pending_payment", paymentExpiresAt: null }, now)).toBe(false);
  });

  it("follows the status for everything else", () => {
    expect(isLiveHold({ status: "confirmed", paymentExpiresAt: earlier }, now)).toBe(true);
    expect(isLiveHold({ status: "completed", paymentExpiresAt: null }, now)).toBe(true);
    expect(isLiveHold({ status: "cancelled", paymentExpiresAt: later }, now)).toBe(false);
  });
});
