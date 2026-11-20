"use server";

import { redirect } from "next/navigation";
import type { CancelState } from "@/components/bookings/cancel-form";
import { sendCancellationEmail } from "@/lib/booking/email";
import { createMailer } from "@/lib/email/resend";
import { cancelBookingByToken } from "@/lib/booking/manage";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";


export async function cancelBookingAction(token: string, _previous: CancelState): Promise<CancelState> {
  let result: Awaited<ReturnType<typeof cancelBookingByToken>>;
  try {
    result = await runWithDb((db) => cancelBookingByToken(db, token));
  } catch (error) {
    console.error(`cancelBooking failed: ${safeErrorSummary(error)}`);
    return { error: "We couldn’t cancel your booking. Please try again, or call us." };
  }

  if (!result.ok) {
    return {
      error:
        result.reason === "not_found"
          ? "We couldn’t find this booking."
          : "This booking can no longer be cancelled online. Please call us.",
    };
  }

  const { booking, refundDue, previousStatus } = result;
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

  redirect(`/bookings/${token}?cancelled=${refundDue ? "refund" : "1"}`);
}
