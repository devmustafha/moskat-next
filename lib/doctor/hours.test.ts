import { describe, expect, it } from "vitest";
import { type HoursEntry, parseWeeklyHours, planHoursReplacement, previousDay, type StoredRule } from "./hours";

const parse = (entries: HoursEntry[], consultationMinutes = 30) => parseWeeklyHours(entries, { consultationMinutes });

describe("parseWeeklyHours", () => {
  it("returns sorted windows and ignores empty rows", () => {
    const result = parse([
      { weekday: "3", start: "14:00", end: "16:00" },
      { weekday: "1", start: "", end: "" },
      { weekday: "1", start: "13:00", end: "15:30" },
      { weekday: "1", start: "09:00", end: "12:00" },
    ]);
    expect(result).toEqual({
      ok: true,
      windows: [
        { weekday: 1, startTime: "09:00", endTime: "12:00" },
        { weekday: 1, startTime: "13:00", endTime: "15:30" },
        { weekday: 3, startTime: "14:00", endTime: "16:00" },
      ],
    });
  });

  it("accepts no hours at all (a doctor taking no video consultations)", () => {
    expect(parse([])).toEqual({ ok: true, windows: [] });
  });

  it("accepts seconds from stored times", () => {
    expect(parse([{ weekday: 2, start: "09:00:00", end: "10:00:00" }])).toEqual({
      ok: true,
      windows: [{ weekday: 2, startTime: "09:00", endTime: "10:00" }],
    });
  });

  it.each([
    [{ weekday: 1, start: "09:00", end: "" }, "Monday: enter both a start and an end time."],
    [{ weekday: 1, start: "9am", end: "10:00" }, "Monday: enter times like 09:00."],
    [{ weekday: 1, start: "09:03", end: "10:00" }, "Monday: times must be on 5-minute steps."],
    [{ weekday: 2, start: "10:00", end: "09:00" }, "Tuesday: the end time must be after the start time."],
    [{ weekday: 2, start: "10:00", end: "10:00" }, "Tuesday: the end time must be after the start time."],
    [{ weekday: 7, start: "10:00", end: "10:20" }, "Sunday: each window must be at least one consultation (30 minutes) long."],
    [{ weekday: 8, start: "10:00", end: "11:00" }, "Please check the form."],
    [{ weekday: "x", start: "10:00", end: "11:00" }, "Please check the form."],
  ])("rejects %o", (entry, message) => {
    expect(parse([entry])).toEqual({ ok: false, message });
  });

  it("rejects overlapping windows on the same day, even when not adjacent in the form", () => {
    const result = parse([
      { weekday: 1, start: "09:00", end: "17:00" },
      { weekday: 2, start: "09:00", end: "10:00" },
      { weekday: 1, start: "12:00", end: "13:00" },
    ]);
    expect(result).toEqual({ ok: false, message: "Monday: windows can’t overlap." });
  });

  it("allows back-to-back windows", () => {
    const result = parse([
      { weekday: 1, start: "09:00", end: "10:00" },
      { weekday: 1, start: "10:00", end: "11:00" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("limits the windows per day", () => {
    const entries = ["08", "10", "12", "14", "16"].map((hour) => ({ weekday: 4, start: `${hour}:00`, end: `${hour}:30` }));
    expect(parse(entries)).toEqual({ ok: false, message: "Thursday: at most 4 windows a day." });
  });
});

describe("previousDay", () => {
  it("handles month and year boundaries", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });
});

describe("planHoursReplacement", () => {
  const today = "2026-11-20";
  const stored = (id: number, weekday: number, startTime: string, endTime: string, extra: Partial<StoredRule> = {}): StoredRule => ({
    id,
    weekday,
    startTime,
    endTime,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    ...extra,
  });

  it("ends rules that started before today, deletes ones that start today or later, and inserts from today", () => {
    const plan = planHoursReplacement(
      [
        stored(1, 1, "09:00:00", "12:00:00"),
        stored(2, 2, "09:00:00", "12:00:00", { effectiveFrom: today }),
        stored(3, 3, "09:00:00", "12:00:00", { effectiveFrom: "2026-12-01" }),
        stored(4, 4, "09:00:00", "12:00:00", { effectiveUntil: "2026-06-30" }),
        stored(5, 5, "09:00:00", "12:00:00", { effectiveUntil: "2026-12-31" }),
      ],
      [{ weekday: 1, startTime: "10:00", endTime: "12:00" }],
      today,
    );
    expect(plan).toEqual({
      changed: true,
      end: [
        { id: 1, effectiveUntil: "2026-11-19" },
        { id: 5, effectiveUntil: "2026-11-19" },
      ],
      remove: [2, 3],
      insert: [{ weekday: 1, startTime: "10:00", endTime: "12:00", effectiveFrom: today }],
    });
  });

  it("is a no-op when the hours in effect are saved unchanged", () => {
    const plan = planHoursReplacement(
      [stored(1, 1, "09:00:00", "12:00:00"), stored(2, 1, "13:00:00", "15:00:00"), stored(3, 2, "09:00:00", "10:00:00", { effectiveUntil: "2026-01-31" })],
      [
        { weekday: 1, startTime: "13:00", endTime: "15:00" },
        { weekday: 1, startTime: "09:00", endTime: "12:00" },
      ],
      today,
    );
    expect(plan).toEqual({ changed: false });
  });

  it("still replaces when the same hours are saved but a change is scheduled later", () => {
    const plan = planHoursReplacement(
      [stored(1, 1, "09:00:00", "12:00:00"), stored(2, 2, "09:00:00", "12:00:00", { effectiveFrom: "2026-12-01" })],
      [{ weekday: 1, startTime: "09:00", endTime: "12:00" }],
      today,
    );
    expect(plan).toMatchObject({ changed: true, end: [{ id: 1 }], remove: [2] });
  });

  it("clears all hours", () => {
    const plan = planHoursReplacement([stored(1, 1, "09:00:00", "12:00:00")], [], today);
    expect(plan).toEqual({ changed: true, end: [{ id: 1, effectiveUntil: "2026-11-19" }], remove: [], insert: [] });
  });
});
