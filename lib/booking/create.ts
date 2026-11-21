import { and, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { PatientSession } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { pgErrorCode } from "@/lib/db/errors";
import { consultationBookings } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";
import { type BookableDoctor, findBookableDoctor, loadSlotQuery } from "./availability";
import { findSlot } from "./slots";
import { createManageToken, createReference, hashToken } from "./tokens";

const MINUTE = 60 * 1000;

/**
 * What a patient submits. Only the minimum needed to run a video consultation. The email is the
 * patient's account email (Paystack sends the receipt there), so it isn't a form field.
 */
export const bookingInputSchema = z.object({
  doctorSlug: z.string().min(1).max(100),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2, "Please enter your full name.").max(120, "Please shorten your name."),
  phone: z
    .string()
    .trim()
    .max(32, "Please shorten your phone number.")
    .regex(/^[+()\d\s.-]*$/, "Please use digits, spaces and + ( ) - only.")
    .transform((value) => value || null),
  consent: z.literal(true, { error: "Please confirm you’ve read the privacy notice." }),
});

/** Raw, unvalidated form input. `createBooking` validates it with `bookingInputSchema`. */
export type BookingInput = {
  doctorSlug: string;
  startsAt: string;
  name: string;
  phone: string;
  consent: boolean;
};

export type CreatedBooking = {
  id: string;
  reference: string;
  doctor: BookableDoctor;
  startsAt: Date;
  endsAt: Date;
  feeCents: number;
  currency: string;
  patientName: string;
  patientEmail: string;
  /** The unpaid hold on the slot lapses at this time. */
  paymentExpiresAt: Date;
};

export type CreateBookingResult =
  | { ok: true; booking: CreatedBooking }
  | { ok: false; reason: "invalid_input"; fieldErrors: Record<string, string[] | undefined> }
  | { ok: false; reason: "doctor_not_found" | "slot_unavailable" | "slot_taken" | "not_payable" };

/** Postgres error code for an exclusion-constraint violation (bookings_no_overlap). */
const EXCLUSION_VIOLATION = "23P01";
const UNIQUE_VIOLATION = "23505";

/**
 * Cancel (as `system`) the doctor's lapsed unpaid holds that overlap [start, end), so the slot is
 * free again for the exclusion constraint. The daily job sweeps any others.
 */
export async function releaseLapsedHolds(db: Db, doctorId: number, start: Date, end: Date, now: Date) {
  await db
    .update(consultationBookings)
    .set({ status: "cancelled", cancelledAt: now, cancelledBy: "system" })
    .where(
      and(
        eq(consultationBookings.doctorId, doctorId),
        eq(consultationBookings.status, "pending_payment"),
        or(isNull(consultationBookings.paymentExpiresAt), lte(consultationBookings.paymentExpiresAt, now)),
        lt(consultationBookings.startsAt, end),
        gt(consultationBookings.endsAt, start),
      ),
    );
}

/** Release one unpaid hold straight away (e.g. checkout couldn't start), as `system`. */
export async function releaseHold(db: Db, bookingId: string, now = new Date()) {
  await db
    .update(consultationBookings)
    .set({ status: "cancelled", cancelledAt: now, cancelledBy: "system" })
    .where(and(eq(consultationBookings.id, bookingId), eq(consultationBookings.status, "pending_payment")));
}

/**
 * Book a consultation for a signed-in patient, as an unpaid hold (`pending_payment`) that lasts
 * `siteConfig.booking.paymentHoldMinutes`. It's confirmed only when Paystack confirms payment
 * (lib/payments/settle.ts). The requested time is re-checked against the doctor's current hours,
 * and the database's no-overlap constraint is the final guard against double-booking: if two
 * patients submit the same slot at once, exactly one insert succeeds.
 */
export async function createBooking(db: Db, input: BookingInput, patient: PatientSession, now = new Date()): Promise<CreateBookingResult> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_input", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const data = parsed.data;

  const doctor = await findBookableDoctor(db, data.doctorSlug);
  if (!doctor) return { ok: false, reason: "doctor_not_found" };
  // Paystack charges in the site currency only; a fee in anything else can't be paid online.
  if (doctor.currency !== siteConfig.currency || doctor.consultationFeeCents <= 0) return { ok: false, reason: "not_payable" };

  const requested = new Date(data.startsAt);
  await releaseLapsedHolds(db, doctor.id, requested, new Date(requested.getTime() + doctor.consultationMinutes * MINUTE), now);

  const slot = findSlot(await loadSlotQuery(db, doctor, now), requested);
  if (!slot) return { ok: false, reason: "slot_unavailable" };

  // Bookings keep a manage-token hash (the column is required); new bookings are managed from the
  // patient's account, so the token itself is discarded.
  const manageTokenHash = await hashToken(createManageToken());
  const paymentExpiresAt = new Date(now.getTime() + siteConfig.booking.paymentHoldMinutes * MINUTE);

  // A reference collision is astronomically unlikely, but retry rather than fail.
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = createReference();
    try {
      const [row] = await db
        .insert(consultationBookings)
        .values({
          reference,
          manageTokenHash,
          doctorId: doctor.id,
          startsAt: slot.start,
          endsAt: slot.end,
          status: "pending_payment",
          paymentExpiresAt,
          feeCents: doctor.consultationFeeCents,
          currency: doctor.currency,
          patientName: data.name,
          patientEmail: patient.email,
          patientPhone: data.phone,
          patientUserId: patient.id,
          consentedAt: now,
        })
        .returning({ id: consultationBookings.id });

      return {
        ok: true,
        booking: {
          id: row.id,
          reference,
          doctor,
          startsAt: slot.start,
          endsAt: slot.end,
          feeCents: doctor.consultationFeeCents,
          currency: doctor.currency,
          patientName: data.name,
          patientEmail: patient.email,
          paymentExpiresAt,
        },
      };
    } catch (error) {
      const code = pgErrorCode(error);
      if (code === EXCLUSION_VIOLATION) return { ok: false, reason: "slot_taken" };
      if (code === UNIQUE_VIOLATION) continue;
      // Rethrow without the driver's detail, which can contain patient data.
      throw new Error(`Booking insert failed${code ? ` (${code})` : ""}`);
    }
  }
  throw new Error("Could not generate a unique booking reference");
}
