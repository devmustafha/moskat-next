"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionOn, isPatient } from "@/lib/auth/session";
import { createBooking } from "@/lib/booking/create";
import { clientIp, isBookingRateLimited } from "@/lib/booking/rate-limit";
import { sendConfirmationEmail } from "@/lib/booking/email";
import { createMailer } from "@/lib/email/resend";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";

export type BookingFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** A slot that turned out to be unavailable, so the form can hide it. */
  unavailable?: string;
  /** What the patient typed, so the form can refill itself (React resets forms after an action). */
  values?: { name: string; email: string; phone: string; consent: boolean };
};

const GENERIC_ERROR = "Something went wrong and your booking wasn’t made. Please try again, or call us to book.";

/**
 * Origin for links in emails, from the Host header the request was routed on.
 * Deliberately ignores X-Forwarded-* headers, which a client could set to plant another domain.
 */
async function origin() {
  const host = (await headers()).get("host") ?? "localhost";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  return `${local ? "http" : "https"}://${host}`;
}

async function isRateLimited() {
  const ip = clientIp(await headers());
  try {
    return await runWithDb((db) => isBookingRateLimited(db, ip));
  } catch (error) {
    // Never block bookings because the limiter itself is unavailable.
    console.error(`Booking rate limit check failed: ${safeErrorSummary(error)}`);
    return false;
  }
}

export async function createBookingAction(_previous: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const startsAt = String(formData.get("startsAt") ?? "");
  const input = {
    doctorSlug: String(formData.get("doctorSlug") ?? ""),
    startsAt,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    consent: formData.get("consent") === "on",
  };
  const values = { name: input.name, email: input.email, phone: input.phone, consent: input.consent };

  // Honeypot: real people never see or fill this field.
  if (formData.get("website")) return { status: "error", message: GENERIC_ERROR };

  if (await isRateLimited()) {
    return { status: "error", message: "Too many booking attempts. Please wait a minute and try again.", values };
  }

  let result: Awaited<ReturnType<typeof createBooking>>;
  try {
    result = await runWithDb(async (db) => {
      // A signed-in patient's booking is linked to their account; anyone else books as a guest.
      const user = await getSessionOn(db);
      return createBooking(db, input, { patient: isPatient(user) ? user : null });
    });
  } catch (error) {
    // Never log the message: it can contain query parameters (patient data).
    console.error(`createBooking failed: ${safeErrorSummary(error)}`);
    return { status: "error", message: GENERIC_ERROR, values };
  }

  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return {
          status: "error",
          message: result.fieldErrors.startsAt ? "Please choose a time." : "Please check the highlighted fields.",
          fieldErrors: result.fieldErrors,
          values,
        };
      case "slot_taken":
      case "slot_unavailable":
        return {
          status: "error",
          message: "Sorry, that time has just been taken. Please choose another time.",
          unavailable: startsAt,
          values,
        };
      case "doctor_not_found":
        return { status: "error", message: "This doctor isn’t taking online bookings at the moment.", values };
    }
  }

  const { booking } = result;
  const manageUrl = `${await origin()}/bookings/${booking.token}`;
  let emailed = true;
  try {
    await sendConfirmationEmail(createMailer(), booking, manageUrl);
  } catch (error) {
    // The booking stands; the confirmation page shows the link instead.
    emailed = false;
    console.error(`Confirmation email failed for booking ${booking.id}: ${safeErrorSummary(error)}`);
  }

  redirect(`/bookings/${booking.token}?new=1${emailed ? "" : "&email=failed"}`);
}
