"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionOn, isPatient } from "@/lib/auth/session";
import { createBooking, releaseHold } from "@/lib/booking/create";
import { clientIp, isBookingRateLimited } from "@/lib/booking/rate-limit";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { startCheckout } from "@/lib/payments/checkout";

export type BookingFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** A slot that turned out to be unavailable, so the form can hide it. */
  unavailable?: string;
  /** What the patient typed, so the form can refill itself (React resets forms after an action). */
  values?: { name: string; phone: string; consent: boolean };
};

const GENERIC_ERROR = "Something went wrong and your booking wasn’t made. Please try again, or call us to book.";
const PAYMENTS_DOWN = "We couldn’t start the payment, so your booking wasn’t made and the time is still free. Please try again in a few minutes, or call us to book.";

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

type Outcome = BookingFormState | { signIn: true } | { checkoutUrl: string };

/**
 * Book as a signed-in patient: hold the slot (`pending_payment`), start Paystack checkout and send
 * the patient there. The booking is confirmed only when Paystack confirms payment, server-side.
 */
export async function createBookingAction(_previous: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const doctorSlug = String(formData.get("doctorSlug") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const input = {
    doctorSlug,
    startsAt,
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    consent: formData.get("consent") === "on",
  };
  const values = { name: input.name, phone: input.phone, consent: input.consent };

  // Honeypot: real people never see or fill this field.
  if (formData.get("website")) return { status: "error", message: GENERIC_ERROR };

  if (await isRateLimited()) {
    return { status: "error", message: "Too many booking attempts. Please wait a minute and try again.", values };
  }

  let outcome: Outcome;
  try {
    outcome = await runWithDb(async (db): Promise<Outcome> => {
      // Only signed-in patients book: the token for the video call is tied to their account.
      const user = await getSessionOn(db);
      if (!isPatient(user)) return { signIn: true };

      const result = await createBooking(db, input, user);
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
            return { status: "error", message: "Sorry, that time has just been taken. Please choose another time.", unavailable: startsAt, values };
          case "doctor_not_found":
          case "not_payable":
            return { status: "error", message: "This doctor isn’t taking online bookings at the moment.", values };
        }
      }

      const { booking } = result;
      const checkout = await startCheckout(db, { ...booking, status: "pending_payment" });
      if (!checkout.ok) {
        // Don't keep the slot held for a payment that can't start.
        await releaseHold(db, booking.id);
        return { status: "error", message: PAYMENTS_DOWN, values };
      }
      return { checkoutUrl: checkout.authorizationUrl };
    });
  } catch (error) {
    // Never log the message: it can contain query parameters (patient data).
    console.error(`createBooking failed: ${safeErrorSummary(error)}`);
    return { status: "error", message: GENERIC_ERROR, values };
  }

  // Redirects happen outside the try, so they aren't caught as errors.
  if ("signIn" in outcome) redirect(`/sign-in?next=${encodeURIComponent(`/doctors/${encodeURIComponent(doctorSlug)}/book`)}`);
  if ("checkoutUrl" in outcome) redirect(outcome.checkoutUrl);
  return outcome;
}
