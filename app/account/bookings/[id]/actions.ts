"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CancelState } from "@/components/bookings/cancel-form";
import { cancelPatientBooking, findPatientBooking } from "@/lib/account/queries";
import { getSessionOn, isPatient, type SessionUser } from "@/lib/auth/session";
import { sendCancellationEmail } from "@/lib/booking/email";
import type { CancelResult } from "@/lib/booking/manage";
import { clientIp, isBookingRateLimited } from "@/lib/booking/rate-limit";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { createMailer } from "@/lib/email/resend";
import { startCheckout } from "@/lib/payments/checkout";

/** Cancel one of the signed-in patient's own bookings from their account. */
export async function cancelOwnBookingAction(id: string, _previous: CancelState): Promise<CancelState> {
  let user: SessionUser | null;
  let result: CancelResult | null;
  try {
    ({ user, result } = await runWithDb(async (db) => {
      const user = await getSessionOn(db);
      // Ownership is enforced by the query: it only touches bookings linked to this patient.
      return { user, result: isPatient(user) ? await cancelPatientBooking(db, user, id) : null };
    }));
  } catch (error) {
    console.error(`cancelOwnBooking failed: ${safeErrorSummary(error)}`);
    return { error: "We couldn’t cancel your booking. Please try again, or call us." };
  }

  // Outside the try, so the redirect isn't caught as an error.
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/account/bookings/${id}`)}`);
  if (!result) return { error: "Only patient accounts can cancel bookings here." };

  if (!result.ok) {
    return {
      error:
        result.reason === "not_found"
          ? "We couldn’t find this booking."
          : "This booking can no longer be cancelled online. Please call us.",
    };
  }

  const { booking, refundDue, previousStatus } = result;
  // An unpaid hold the patient abandons needs no email.
  if (booking.patientName && booking.patientEmail && previousStatus !== "pending_payment") {
    try {
      await sendCancellationEmail(
        createMailer(),
        { ...booking, patientName: booking.patientName, patientEmail: booking.patientEmail },
        { refundDue },
      );
    } catch (error) {
      console.error(`Cancellation email failed for booking ${booking.id}: ${safeErrorSummary(error)}`);
    }
  }

  // `booking.id` came from the database, so it's safe in the URL.
  redirect(`/account/bookings/${booking.id}?cancelled=${refundDue ? "refund" : "1"}`);
}

export type PayState = { error?: string };

/** Restart Paystack checkout for one of the patient's unpaid bookings, while its hold lasts. */
export async function payBookingAction(id: string, _previous: PayState): Promise<PayState> {
  const ip = clientIp(await headers());
  let outcome: { signIn: true } | { url: string } | PayState;
  try {
    outcome = await runWithDb(async (db) => {
      const user = await getSessionOn(db);
      if (!isPatient(user)) return { signIn: true } as const;
      if (await isBookingRateLimited(db, ip)) return { error: "Too many attempts. Please wait a minute and try again." };

      const booking = await findPatientBooking(db, user, id);
      if (!booking) return { error: "We couldn’t find this booking." };
      const checkout = await startCheckout(db, booking);
      if (checkout.ok) return { url: checkout.authorizationUrl };
      return {
        error:
          checkout.reason === "not_payable"
            ? "This booking can’t be paid any more: the time was released. Please book again."
            : "We couldn’t start the payment. Please try again in a few minutes.",
      };
    });
  } catch (error) {
    console.error(`payBooking failed: ${safeErrorSummary(error)}`);
    return { error: "We couldn’t start the payment. Please try again in a few minutes." };
  }

  if ("signIn" in outcome) redirect(`/sign-in?next=${encodeURIComponent(`/account/bookings/${id}`)}`);
  if ("url" in outcome) redirect(outcome.url);
  return outcome;
}
