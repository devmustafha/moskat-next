/**
 * Money is integer minor units (cents) plus a currency code, never floats. These helpers convert
 * between cents and what an admin types into a form ("45" or "45.50").
 */

/** Cents from a typed amount like "45", "45.5" or "45.50"; null if it isn't a plain amount. */
export function parseAmountToCents(input: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** The amount to prefill a form with: 4500 → "45", 4550 → "45.50". */
export function centsToAmount(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}
