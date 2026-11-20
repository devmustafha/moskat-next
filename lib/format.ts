import { TZDate } from "@date-fns/tz";
import { siteConfig } from "@/lib/site";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, fractionDigits: number) {
  const key = `${currency}:${fractionDigits}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(siteConfig.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format an amount in minor units (kobo for NGN), e.g. 2500000 → "₦25,000", 2500050 → "₦25,000.50".
 * Whole amounts are shown without decimals.
 */
export function formatPrice(cents: number, currency: string = siteConfig.currency) {
  const whole = cents % 100 === 0;
  return currencyFormatter(currency, whole ? 0 : 2).format(cents / 100);
}

// Dates are calendar dates (YYYY-MM-DD); format in UTC so they never shift by a day.
const dateFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Format an ISO calendar date, e.g. "2026-11-04" → "4 November 2026". */
export function formatDate(isoDate: string) {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Monday, 23 November" for an instant, in the given time zone. */
export function formatDay(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, { weekday: "long", month: "long", day: "numeric", timeZone }).format(instant);
}

// Times use a 12-hour clock ("9:30 am") like the site copy, although en-NG defaults to 24 hours.

/** "9:30 am" for an instant, in the given time zone. */
export function formatTime(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(instant);
}

/** "Monday, 23 November 2026 at 9:30 am WAT": a full appointment time with the zone spelled out. */
export function formatSlot(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short",
  }).format(instant);
}

/** Readable zone name, e.g. "West Africa Time" for Africa/Lagos. */
export function formatTimeZoneName(timeZone: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat(siteConfig.locale, { timeZone, timeZoneName: "longGeneric" }).formatToParts(at);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function isoDateIn(instant: Date, timeZone: string) {
  const local = new TZDate(instant, timeZone);
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${local.getFullYear()}-${month}-${day}`;
}

/** The instant a calendar day starts (local midnight) in a time zone, for the day containing `instant`. */
export function startOfDayIn(instant: Date, timeZone: string) {
  const local = new TZDate(instant, timeZone);
  return new Date(new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), timeZone).getTime());
}

/** "9:30 am" for a wall-clock time stored as "HH:MM" or "HH:MM:SS" (weekly hours). */
export function formatWallTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(siteConfig.locale, { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(
    Date.UTC(2024, 0, 1, hours, minutes),
  );
}

/** "Monday" for an ISO weekday (1 = Monday … 7 = Sunday). */
export function formatWeekday(isoWeekday: number) {
  // January 1, 2024 was a Monday.
  return new Intl.DateTimeFormat(siteConfig.locale, { weekday: "long", timeZone: "UTC" }).format(Date.UTC(2024, 0, isoWeekday));
}
