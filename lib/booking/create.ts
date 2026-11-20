import { z } from "zod";
import type { PatientSession } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { pgErrorCode } from "@/lib/db/errors";
import { consultationBookings } from "@/lib/db/schema";
import { type BookableDoctor, findBookableDoctor, loadSlotQuery } from "./availability";
import { findSlot } from "./slots";
import { createManageToken, createReference, hashToken } from "./tokens";

/** What a patient submits. Only the minimum needed to run a video consultation. */
export const bookingInputSchema = z.object({
  doctorSlug: z.string().min(1).max(100),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2, "Please enter your full name.").max(120, "Please shorten your name."),
  email: z
    .email("Please enter a valid email address.")
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
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
  email: string;
  phone: string;
  consent: boolean;
};

export type CreatedBooking = {
  id: string;
  reference: string;
  /** Plain manage token for the patient's link. Not stored; only its hash is. */
  token: string;
  doctor: BookableDoctor;
  startsAt: Date;
  endsAt: Date;
  feeCents: number;
  currency: string;
  patientName: string;
  patientEmail: string;
};

export type CreateBookingResult =
  | { ok: true; booking: CreatedBooking }
  | { ok: false; reason: "invalid_input"; fieldErrors: Record<string, string[] | undefined> }
  | { ok: false; reason: "doctor_not_found" | "slot_unavailable" | "slot_taken" };

/** Postgres error code for an exclusion-constraint violation (bookings_no_overlap). */
const EXCLUSION_VIOLATION = "23P01";
const UNIQUE_VIOLATION = "23505";

export type CreateBookingOptions = {
  /**
   * The signed-in patient from `requirePatient`/`getSessionOn`, if any: the booking is linked
   * to their account. Guests, and doctors or admins booking for themselves, pass nothing.
   */
  patient?: PatientSession | null;
  now?: Date;
};

/**
 * Book a consultation. The requested time is re-checked against the doctor's current hours,
 * and the database's no-overlap constraint is the final guard against double-booking: if two
 * patients submit the same slot at once, exactly one insert succeeds.
 */
export async function createBooking(
  db: Db,
  input: BookingInput,
  { patient = null, now = new Date() }: CreateBookingOptions = {},
): Promise<CreateBookingResult> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_input", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const data = parsed.data;

  const doctor = await findBookableDoctor(db, data.doctorSlug);
  if (!doctor) return { ok: false, reason: "doctor_not_found" };

  const slot = findSlot(await loadSlotQuery(db, doctor, now), new Date(data.startsAt));
  if (!slot) return { ok: false, reason: "slot_unavailable" };

  const token = createManageToken();
  const manageTokenHash = await hashToken(token);

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
          status: "confirmed",
          feeCents: doctor.consultationFeeCents,
          currency: doctor.currency,
          patientName: data.name,
          patientEmail: data.email,
          patientPhone: data.phone,
          patientUserId: patient?.id ?? null,
          consentedAt: now,
        })
        .returning({ id: consultationBookings.id });

      return {
        ok: true,
        booking: {
          id: row.id,
          reference,
          token,
          doctor,
          startsAt: slot.start,
          endsAt: slot.end,
          feeCents: doctor.consultationFeeCents,
          currency: doctor.currency,
          patientName: data.name,
          patientEmail: data.email,
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
