import type { WeeklyRule } from "@/lib/booking/slots";

/**
 * A doctor's weekly video hours as they edit them: windows of wall-clock time per ISO weekday,
 * in the doctor's time zone. Pure: no database access, so it can be unit-tested.
 */

export const HOURS_LIMITS = {
  windowsPerDay: 4,
  /** Times must fall on this many minutes (the form's time inputs use the same step). */
  stepMinutes: 5,
} as const;

/** One submitted row of the hours form; unvalidated. */
export type HoursEntry = { weekday: unknown; start: unknown; end: unknown };

/** A validated window: "HH:MM" times, end after start on the same day. */
export type HoursWindow = { weekday: number; startTime: string; endTime: string };

export type ParseHoursResult = { ok: true; windows: HoursWindow[] } | { ok: false; message: string };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/;

/** Minutes after midnight for "HH:MM" or "HH:MM:SS". */
function minuteOf(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "09:00:00" → "09:00". */
export function toHHMM(value: string) {
  return value.slice(0, 5);
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Validate the submitted rows. Rows with neither time filled in are ignored (an added row left
 * empty). Each window must be at least one consultation long, or it would offer no slots.
 */
export function parseWeeklyHours(entries: HoursEntry[], { consultationMinutes }: { consultationMinutes: number }): ParseHoursResult {
  const windows: HoursWindow[] = [];

  for (const entry of entries) {
    const start = typeof entry.start === "string" ? entry.start.trim() : "";
    const end = typeof entry.end === "string" ? entry.end.trim() : "";
    if (!start && !end) continue;

    const weekday = Number(entry.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return { ok: false, message: "Please check the form." };
    const day = WEEKDAYS[weekday - 1];

    if (!start || !end) return { ok: false, message: `${day}: enter both a start and an end time.` };
    if (!TIME.test(start) || !TIME.test(end)) return { ok: false, message: `${day}: enter times like 09:00.` };

    const from = minuteOf(start);
    const to = minuteOf(end);
    if (from % HOURS_LIMITS.stepMinutes || to % HOURS_LIMITS.stepMinutes) {
      return { ok: false, message: `${day}: times must be on ${HOURS_LIMITS.stepMinutes}-minute steps.` };
    }
    if (to <= from) return { ok: false, message: `${day}: the end time must be after the start time.` };
    if (to - from < consultationMinutes) {
      return { ok: false, message: `${day}: each window must be at least one consultation (${consultationMinutes} minutes) long.` };
    }
    windows.push({ weekday, startTime: toHHMM(start), endTime: toHHMM(end) });
  }

  windows.sort((a, b) => a.weekday - b.weekday || minuteOf(a.startTime) - minuteOf(b.startTime));

  for (let index = 0; index < windows.length; index++) {
    const window = windows[index];
    const day = WEEKDAYS[window.weekday - 1];
    const sameDay = windows.filter((other) => other.weekday === window.weekday);
    if (sameDay.length > HOURS_LIMITS.windowsPerDay) {
      return { ok: false, message: `${day}: at most ${HOURS_LIMITS.windowsPerDay} windows a day.` };
    }
    const next = windows[index + 1];
    if (next && next.weekday === window.weekday && minuteOf(next.startTime) < minuteOf(window.endTime)) {
      return { ok: false, message: `${day}: windows can’t overlap.` };
    }
  }

  return { ok: true, windows };
}

export type StoredRule = WeeklyRule & { id: number };

export type HoursPlan =
  | { changed: false }
  | {
      changed: true;
      /** Rules that started before today: end them yesterday, keeping their history. */
      end: { id: number; effectiveUntil: string }[];
      /** Rules starting today or later that never took effect: remove them. */
      remove: number[];
      /** The new hours, from today, open-ended. */
      insert: (HoursWindow & { effectiveFrom: string })[];
    };

/** The calendar day before an ISO date. */
export function previousDay(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const key = (window: HoursWindow) => `${window.weekday} ${toHHMM(window.startTime)} ${toHHMM(window.endTime)}`;

/**
 * How to replace a doctor's weekly hours with `next`, from `today` (YYYY-MM-DD in the doctor's
 * time zone). Rules that already ended are left alone. Nothing changes when `next` matches the
 * open-ended rules in effect today and nothing else is scheduled.
 */
export function planHoursReplacement(existing: StoredRule[], next: HoursWindow[], today: string): HoursPlan {
  const current = existing.filter((rule) => rule.effectiveUntil === null || rule.effectiveUntil >= today);

  const unchanged =
    current.every((rule) => rule.effectiveFrom <= today && rule.effectiveUntil === null) &&
    current.map(key).sort().join("|") === next.map(key).sort().join("|");
  if (unchanged) return { changed: false };

  const yesterday = previousDay(today);
  return {
    changed: true,
    end: current.filter((rule) => rule.effectiveFrom < today).map((rule) => ({ id: rule.id, effectiveUntil: yesterday })),
    remove: current.filter((rule) => rule.effectiveFrom >= today).map((rule) => rule.id),
    insert: next.map((window) => ({ ...window, effectiveFrom: today })),
  };
}
