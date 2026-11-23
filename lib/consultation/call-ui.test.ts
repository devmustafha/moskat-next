import { describe, expect, it } from "vitest";
import {
  CALL_ERROR_CODES,
  describeCallEnded,
  describeDeviceProblem,
  describeDisconnect,
  describeEndProblem,
  describeJoinError,
  describeTokenProblem,
  formatCountdown,
  signalLevel,
  TOKEN_ERROR_CODES,
} from "./call-ui";

const timeZone = "Africa/Lagos";

describe("describeTokenProblem", () => {
  it("has words for every endpoint error and for no response", () => {
    for (const code of [...TOKEN_ERROR_CODES, "network" as const]) {
      const text = describeTokenProblem(code, { role: "patient", timeZone });
      expect(text.message.length).toBeGreaterThan(10);
    }
  });

  it("says when the call opens, in the booking's time zone", () => {
    const opensAt = new Date("2026-11-20T08:50:00Z"); // 9:50 am in Lagos
    expect(describeTokenProblem("too_early", { role: "patient", opensAt, timeZone })).toEqual({
      message: "The call opens at 9:50 am. You can join from then.",
      retry: true,
    });
  });

  it("only offers a retry when trying again can work", () => {
    const retry = (code: Parameters<typeof describeTokenProblem>[0]) => describeTokenProblem(code, { role: "doctor", timeZone }).retry;
    expect(["rate_limited", "network", "unavailable", "too_early"].every((c) => retry(c as never))).toBe(true);
    expect(["ended", "cancelled", "closed", "not_paid", "not_found", "signed_out"].some((c) => retry(c as never))).toBe(false);
  });
});

describe("describeDeviceProblem", () => {
  it("explains a blocked permission for the right device", () => {
    expect(describeDeviceProblem("PERMISSION_DENIED", "camera")).toMatch(/blocked the camera/);
    expect(describeDeviceProblem("NOT_READABLE", "microphone")).toMatch(/microphone is in use/);
  });

  it("has a fallback for unknown errors", () => {
    expect(describeDeviceProblem(undefined, "camera")).toMatch(/couldn’t start/);
  });
});

describe("signalLevel", () => {
  const level = (up: number, down: number) => signalLevel({ uplinkNetworkQuality: up, downlinkNetworkQuality: down }).bars;

  it("uses the worse direction and ignores unknowns", () => {
    expect(level(1, 1)).toBe(3);
    expect(level(1, 3)).toBe(2);
    expect(level(5, 1)).toBe(1);
    expect(level(0, 2)).toBe(3);
    expect(level(6, 1)).toBe(0);
  });

  it("is unknown until Agora has measured", () => {
    expect(signalLevel({ uplinkNetworkQuality: 0, downlinkNetworkQuality: 0 })).toEqual({ bars: 0, label: "Checking your connection" });
  });
});

describe("formatCountdown", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  const plus = (s: number) => new Date(now.getTime() + s * 1000);

  it("counts minutes and seconds, then hours", () => {
    expect(formatCountdown(plus(245), now)).toBe("4:05");
    expect(formatCountdown(plus(3750), now)).toBe("1:02:30");
  });

  it("stops at zero", () => {
    expect(formatCountdown(plus(-5), now)).toBe("0:00");
  });
});

describe("describeJoinError", () => {
  it("explains a second tab with the same identity", () => {
    expect(describeJoinError("UID_CONFLICT").message).toMatch(/another tab/);
    expect(describeJoinError(undefined).retry).toBe(true);
  });
});

describe("describeDisconnect", () => {
  it("says nothing when we left or the token is being replaced", () => {
    expect(describeDisconnect("LEAVE")).toBeNull();
    expect(describeDisconnect("TOKEN_EXPIRE")).toBeNull();
    expect(describeDisconnect(undefined)).toBeNull();
  });

  it("doesn't offer a rejoin after a ban", () => {
    expect(describeDisconnect("UID_BANNED")).toEqual({ message: "You’ve been removed from this call.", retry: false });
  });

  it("offers a rejoin after a dropped connection", () => {
    expect(describeDisconnect("NETWORK_ERROR")).toMatchObject({ retry: true });
    expect(describeDisconnect("LICENSE_EXPIRED")).toMatchObject({ retry: true });
  });
});

describe("describeEndProblem", () => {
  it("has words for every call endpoint error and for no response", () => {
    for (const code of [...CALL_ERROR_CODES, "network" as const]) expect(describeEndProblem(code).length).toBeGreaterThan(10);
  });

  it("tells the doctor to wait for the patient before ending for both", () => {
    expect(describeEndProblem("not_started")).toContain("once your patient has joined");
  });
});

describe("describeCallEnded", () => {
  it("tells each side who ended it", () => {
    expect(describeCallEnded("patient", "doctor").message).toBe("Your doctor ended the consultation.");
    expect(describeCallEnded("doctor", "doctor").message).toBe("You ended the consultation for both of you.");
    expect(describeCallEnded("patient", "system")).toEqual({ message: "This consultation has ended.", retry: false });
  });
});
