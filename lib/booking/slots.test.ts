import { describe, expect, it } from "vitest";
import { activeWeekdays, findSlot, fitsWeeklyHours, listSlots, type SlotQuery, type WeeklyRule } from "./slots";

const NY = "America/New_York";

function rule(weekday: number, startTime: string, endTime: string, extra: Partial<WeeklyRule> = {}): WeeklyRule {
  return { weekday, startTime, endTime, effectiveFrom: "2026-01-01", effectiveUntil: null, ...extra };
}

function query(overrides: Partial<SlotQuery>): SlotQuery {
  return {
    rules: [],
    timeZone: NY,
    minutes: 30,
    busy: [],
    now: new Date("2026-11-15T12:00:00Z"), // Sunday
    leadTimeHours: 0,
    horizonDays: 7,
    ...overrides,
  };
}

const iso = (slots: { start: Date }[]) => slots.map((slot) => slot.start.toISOString());

describe("listSlots", () => {
  it("cuts weekly hours into consultation-length slots in the doctor's time zone", () => {
    // Monday Nov 16 2026, 09:00–10:00 EST (UTC−5).
    const slots = listSlots(query({ rules: [rule(1, "09:00", "10:00")], minutes: 20 }));
    expect(iso(slots)).toEqual(["2026-11-16T14:00:00.000Z", "2026-11-16T14:20:00.000Z", "2026-11-16T14:40:00.000Z"]);
    expect(slots[0].end.toISOString()).toBe("2026-11-16T14:20:00.000Z");
  });

  it("drops a final block that doesn't fit before the end of the window", () => {
    const slots = listSlots(query({ rules: [rule(1, "09:00", "10:10")], minutes: 30 }));
    expect(slots).toHaveLength(2);
  });

  it("skips local times that don't exist when clocks go forward", () => {
    // Sunday March 8 2026: 02:00–02:59 doesn't exist in New York.
    const slots = listSlots(
      query({ rules: [rule(7, "01:30", "03:30")], now: new Date("2026-03-07T12:00:00Z"), horizonDays: 2 }),
    );
    expect(iso(slots)).toEqual(["2026-03-08T06:30:00.000Z", "2026-03-08T07:00:00.000Z"]);
  });

  it("uses a repeated local time once when clocks go back", () => {
    // Sunday November 1 2026: 01:00–01:59 happens twice in New York.
    const slots = listSlots(
      query({ rules: [rule(7, "00:30", "02:00")], now: new Date("2026-10-31T12:00:00Z"), horizonDays: 2 }),
    );
    expect(slots).toHaveLength(3);
    expect(slots[0].start.toISOString()).toBe("2026-11-01T04:30:00.000Z");
    expect(new Set(iso(slots)).size).toBe(3);
  });

  it("respects the lead time and the booking horizon", () => {
    const rules = [rule(1, "09:00", "12:00")];
    // Monday 08:30 EST with a 2-hour lead time: the first bookable slot is 10:30.
    const slots = listSlots(query({ rules, now: new Date("2026-11-16T13:30:00Z"), leadTimeHours: 2, horizonDays: 6 }));
    expect(slots[0].start.toISOString()).toBe("2026-11-16T15:30:00.000Z");
    // A 6-day horizon from Monday doesn't reach the following Monday.
    expect(slots.every((slot) => slot.start < new Date("2026-11-22T00:00:00Z"))).toBe(true);
  });

  it("removes slots that overlap bookings or time off", () => {
    const rules = [rule(1, "09:00", "11:00")];
    const busy = [
      { start: new Date("2026-11-16T14:30:00Z"), end: new Date("2026-11-16T15:00:00Z") }, // a booking
      { start: new Date("2026-11-16T15:15:00Z"), end: new Date("2026-11-16T15:20:00Z") }, // partial overlap
    ];
    expect(iso(listSlots(query({ rules, busy })))).toEqual(["2026-11-16T14:00:00.000Z", "2026-11-16T15:30:00.000Z"]);
  });

  it("ignores rules outside their effective dates", () => {
    const rules = [rule(1, "09:00", "10:00", { effectiveUntil: "2026-11-15" }), rule(2, "09:00", "10:00", { effectiveFrom: "2026-12-01" })];
    expect(listSlots(query({ rules }))).toHaveLength(0);
  });

  it("works in time zones ahead of UTC", () => {
    // Monday 09:00 in Tokyo (UTC+9) is 00:00 UTC on the same day.
    const slots = listSlots(query({ rules: [rule(1, "09:00", "09:30")], timeZone: "Asia/Tokyo" }));
    expect(iso(slots)).toEqual(["2026-11-16T00:00:00.000Z"]);
  });

  it("does not duplicate slots from overlapping rules", () => {
    const slots = listSlots(query({ rules: [rule(1, "09:00", "10:00"), rule(1, "09:30", "10:30")] }));
    expect(iso(slots)).toEqual([
      "2026-11-16T14:00:00.000Z",
      "2026-11-16T14:30:00.000Z",
      "2026-11-16T15:00:00.000Z",
    ]);
  });
});

describe("findSlot", () => {
  it("accepts only exact, currently bookable start times", () => {
    const q = query({ rules: [rule(1, "09:00", "10:00")] });
    expect(findSlot(q, new Date("2026-11-16T14:30:00Z"))).not.toBeNull();
    expect(findSlot(q, new Date("2026-11-16T14:15:00Z"))).toBeNull();
    expect(findSlot(q, new Date("2026-11-17T14:30:00Z"))).toBeNull();
  });
});

describe("activeWeekdays", () => {
  it("lists weekdays with current rules, Monday first", () => {
    const rules = [rule(5, "09:00", "10:00"), rule(1, "09:00", "10:00"), rule(3, "09:00", "10:00", { effectiveUntil: "2026-01-31" })];
    expect(activeWeekdays(rules, "2026-11-15")).toEqual(["Monday", "Friday"]);
  });
});

describe("fitsWeeklyHours", () => {
  const at = (start: string, minutes = 30) => ({ start: new Date(start), end: new Date(new Date(start).getTime() + minutes * 60_000) });

  it("is true only for intervals inside a rule on their local day", () => {
    const rules = [rule(1, "09:00", "10:00")];
    // Monday Nov 16 2026, 09:30–10:00 EST.
    expect(fitsWeeklyHours(at("2026-11-16T14:30:00Z"), rules, NY)).toBe(true);
    // Runs past the end of the window.
    expect(fitsWeeklyHours(at("2026-11-16T14:45:00Z"), rules, NY)).toBe(false);
    // Tuesday.
    expect(fitsWeeklyHours(at("2026-11-17T14:30:00Z"), rules, NY)).toBe(false);
  });

  it("respects effective dates", () => {
    const rules = [rule(1, "09:00", "10:00", { effectiveFrom: "2026-11-17" }), rule(1, "11:00", "12:00", { effectiveUntil: "2026-11-15" })];
    expect(fitsWeeklyHours(at("2026-11-16T14:00:00Z"), rules, NY)).toBe(false);
    expect(fitsWeeklyHours(at("2026-11-16T16:00:00Z"), rules, NY)).toBe(false);
    expect(fitsWeeklyHours(at("2026-11-23T14:00:00Z"), rules, NY)).toBe(true);
  });

  it("uses local wall-clock time across daylight saving", () => {
    const rules = [rule(1, "09:00", "10:00")];
    // Monday March 9 2026 is EDT (UTC−4): 09:00 local is 13:00 UTC.
    expect(fitsWeeklyHours(at("2026-03-09T13:00:00Z"), rules, NY)).toBe(true);
    expect(fitsWeeklyHours(at("2026-03-09T14:00:00Z"), rules, NY)).toBe(false);
  });
});
