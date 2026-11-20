"use server";

import { redirect } from "next/navigation";
import type { CancelState } from "@/components/bookings/cancel-form";
import { cancelPatientBooking } from "@/lib/account/queries";
import { getSessionOn, isPatient, type SessionUser } from "@/lib/auth/session";
import { sendCancellationEmail } from "@/lib/booking/email";
import { createMailer } from "@/lib/email/resend";
import type { CancelResult } from "@/lib/booking/manage";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";

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

  const { booking } = result;
  if (booking.patientName && booking.patientEmail) {
    try {
      await sendCancellationEmail(createMailer(), { ...booking, patientName: booking.patientName, patientEmail: booking.patientEmail });
    } catch (error) {
      console.error(`Cancellation email failed for booking ${booking.id}: ${safeErrorSummary(error)}`);
    }
  }

  // `booking.id` came from the database, so it's safe in the URL.
  redirect(`/account/bookings/${booking.id}?cancelled=1`);
}
