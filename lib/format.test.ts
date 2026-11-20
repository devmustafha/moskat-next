import { describe, expect, it } from "vitest";
import { formatWallTime, formatWeekday, startOfDayIn } from "./format";

describe("startOfDayIn", () => {
  it("returns local midnight in the given zone", () => {
    // 02:30 UTC on Nov 20 is still Nov 19 in New York (UTC-5).
    expect(startOfDayIn(new Date("2026-11-20T02:30:00Z"), "America/New_York").toISOString()).toBe("2026-11-19T05:00:00.000Z");
    expect(startOfDayIn(new Date("2026-11-20T02:30:00Z"), "Europe/Berlin").toISOString()).toBe("2026-11-19T23:00:00.000Z");
  });

  it("handles a daylight-saving change day", () => {
    // March 8, 2026: New York springs forward at 02:00, after midnight EST.
    expect(startOfDayIn(new Date("2026-03-08T18:00:00Z"), "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });
});

describe("formatWallTime", () => {
  it("formats stored weekly-hours times", () => {
    expect(formatWallTime("09:00:00")).toBe("9:00 AM");
    expect(formatWallTime("13:30")).toBe("1:30 PM");
  });
});

describe("formatWeekday", () => {
  it("maps ISO weekdays", () => {
    expect(formatWeekday(1)).toBe("Monday");
    expect(formatWeekday(7)).toBe("Sunday");
  });
});
