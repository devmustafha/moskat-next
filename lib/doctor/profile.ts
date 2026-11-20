import { z } from "zod";
import { parseAmountToCents } from "@/lib/money";

/**
 * What a doctor can change about their own public profile and rates. Name, specialty,
 * department, photo and slug stay with the hospital. Pure: no database access.
 */

export const PROFILE_LIMITS = {
  listItems: 12,
  listItemLength: 120,
  paragraphs: 6,
  paragraphLength: 1000,
  maxYears: 70,
} as const;

/** One item per line: trimmed, blank lines dropped. */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Paragraphs separated by blank lines; line breaks inside a paragraph become spaces. */
export function splitParagraphs(value: string): string[] {
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Form prefill for `splitLines`. */
export const linesToText = (items: readonly string[]) => items.join("\n");

/** Form prefill for `splitParagraphs`. */
export const paragraphsToText = (paragraphs: readonly string[]) => paragraphs.join("\n\n");

function list(label: string) {
  const { listItems, listItemLength } = PROFILE_LIMITS;
  return z
    .string()
    .max(listItems * (listItemLength + 2))
    .transform(splitLines)
    .pipe(
      z
        .array(z.string().max(listItemLength, `Each line in ${label} can be at most ${listItemLength} characters.`))
        .max(listItems, `${label} can have at most ${listItems} lines.`),
    );
}

export const doctorProfileSchema = z.object({
  bio: z
    .string()
    .max(PROFILE_LIMITS.paragraphs * (PROFILE_LIMITS.paragraphLength + 4))
    .transform(splitParagraphs)
    .pipe(
      z
        .array(
          z
            .string()
            .max(PROFILE_LIMITS.paragraphLength, `Each paragraph of your biography can be at most ${PROFILE_LIMITS.paragraphLength} characters.`),
        )
        .min(1, "Please write a short biography.")
        .max(PROFILE_LIMITS.paragraphs, `Your biography can have at most ${PROFILE_LIMITS.paragraphs} paragraphs.`),
    ),
  qualifications: list("Qualifications"),
  languages: list("Languages").pipe(z.array(z.string()).min(1, "List at least one language.")),
  interests: list("Clinical interests"),
  yearsExperience: z.coerce
    .number({ error: "Enter your years of experience as a number." })
    .int("Years of experience must be a whole number.")
    .min(0, "Years of experience can’t be negative.")
    .max(PROFILE_LIMITS.maxYears, `Years of experience can be at most ${PROFILE_LIMITS.maxYears}.`),
});

export type DoctorProfileInput = z.output<typeof doctorProfileSchema>;

/** Fee and consultation length, with the same rules as the admin pricing form. */
export const doctorRatesSchema = z.object({
  fee: z.string().transform((value, ctx) => {
    const cents = parseAmountToCents(value);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter a fee like 45 or 45.50." });
      return z.NEVER;
    }
    return cents;
  }),
  minutes: z.coerce
    .number({ error: "Enter the length in minutes." })
    .int("Whole minutes only.")
    .min(10, "At least 10 minutes.")
    .max(120, "At most 120 minutes."),
});

export type DoctorRatesInput = z.output<typeof doctorRatesSchema>;
