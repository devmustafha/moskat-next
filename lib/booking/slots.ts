import { TZDate } from "@date-fns/tz";

/**
 * Free consultation slots, calculated from weekly hours rather than stored.
 *
 * Weekly hours are wall-clock times in the doctor's time zone ("Monday 09:00–12:00 in New York").
 * Each slot is converted to a real instant, so daylight-saving changes are handled: a local time
 * that doesn't exist (spring forward) is skipped, and a repeated one (fall back) is used once.
 * Pure functions: no database access, so they can be unit-tested.
 */

export type WeeklyRule = {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** "HH:MM" or "HH:MM:SS", local to `timeZone`. */
  startTime: string;
  endTime: string;
  /** First and last calendar day (YYYY-MM-DD, inclusive) the rule applies; null = open-ended. */
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export type Interval = { start: Date; end: Date };

export type SlotQuery = {
  rules: WeeklyRule[];
  timeZone: string;
  minutes: number;
  /** Time off and existing (non-cancelled) bookings. */
  busy: Interval[];
  now: Date;
  leadTimeMinutes: number;
  horizonDays: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Calendar date (y, m, d) of an instant in a time zone. */
function localDate(instant: Date, timeZone: string) {
  const local = new TZDate(instant, timeZone);
  return { year: local.getFullYear(), month: local.getMonth() + 1, day: local.getDate() };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The instant for a local wall-clock time, or null if that time doesn't exist (DST gap). */
function localInstant(year: number, month: number, day: number, minuteOfDay: number, timeZone: string) {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const local = new TZDate(year, month - 1, day, hours, minutes, timeZone);
  if (local.getHours() !== hours || local.getMinutes() !== minutes || local.getDate() !== day) return null;
  return new Date(local.getTime());
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && a.end > b.start;
}

/** All bookable slots in the window [now + lead time, now + horizon), earliest first. */
export function listSlots({ rules, timeZone, minutes, busy, now, leadTimeMinutes, horizonDays }: SlotQuery): Interval[] {
  const earliest = now.getTime() + leadTimeMinutes * MINUTE;
  const latest = now.getTime() + horizonDays * DAY;
  const today = localDate(now, timeZone);
  const seen = new Set<number>();
  const slots: Interval[] = [];

  // One extra day covers time zones where "today" locally is behind the horizon in UTC.
  for (let offset = 0; offset <= horizonDays + 1; offset++) {
    const calendar = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const year = calendar.getUTCFullYear();
    const month = calendar.getUTCMonth() + 1;
    const day = calendar.getUTCDate();
    const date = isoDate(year, month, day);
    const weekday = calendar.getUTCDay() === 0 ? 7 : calendar.getUTCDay();

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      if (date < rule.effectiveFrom) continue;
      if (rule.effectiveUntil && date > rule.effectiveUntil) continue;

      const end = parseTime(rule.endTime);
      for (let minute = parseTime(rule.startTime); minute + minutes <= end; minute += minutes) {
        const start = localInstant(year, month, day, minute, timeZone);
        if (!start) continue;
        const time = start.getTime();
        if (time < earliest || time >= latest || seen.has(time)) continue;

        const slot = { start, end: new Date(time + minutes * MINUTE) };
        if (busy.some((interval) => overlaps(slot, interval))) continue;
        seen.add(time);
        slots.push(slot);
      }
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The slot starting exactly at `start`, if it's currently bookable. */
export function findSlot(query: SlotQuery, start: Date) {
  return listSlots(query).find((slot) => slot.start.getTime() === start.getTime()) ?? null;
}

/**
 * Whether an interval (e.g. an existing booking) lies inside one of the weekly hours that apply on
 * its local calendar day. Used to warn a doctor about bookings their new hours no longer cover.
 */
export function fitsWeeklyHours(interval: Interval, rules: WeeklyRule[], timeZone: string) {
  const { year, month, day } = localDate(interval.start, timeZone);
  const date = isoDate(year, month, day);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekday = utcDay === 0 ? 7 : utcDay;

  return rules.some((rule) => {
    if (rule.weekday !== weekday || date < rule.effectiveFrom) return false;
    if (rule.effectiveUntil && date > rule.effectiveUntil) return false;
    const start = localInstant(year, month, day, parseTime(rule.startTime), timeZone);
    const end = localInstant(year, month, day, parseTime(rule.endTime), timeZone);
    if (!start || !end) return false;
    return interval.start >= start && interval.end <= end;
  });
}

/** Weekday names (Monday first) that have at least one active rule today or later. */
export function activeWeekdays(rules: WeeklyRule[], today: string) {
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const days = new Set(
    rules.filter((rule) => !rule.effectiveUntil || rule.effectiveUntil >= today).map((rule) => rule.weekday),
  );
  return names.filter((_, index) => days.has(index + 1));
}
