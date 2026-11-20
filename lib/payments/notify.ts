import "server-only";
import { eq } from "drizzle-orm";
import { sendConfirmationEmail } from "@/lib/booking/email";
import { selectManagedBookings } from "@/lib/booking/manage";
import type { Db } from "@/lib/db/client";
import { safeErrorSummary } from "@/lib/db/errors";
import { consultationBookings } from "@/lib/db/schema";
import { createMailer } from "@/lib/email/resend";
import { siteUrl } from "@/lib/origin";

/**
 * Email the booking confirmation once a payment has confirmed it. Best effort: the booking stands
 * if the email fails (the account page shows it). Only the caller whose settlePayment returned
 * `confirmed` sends it, so it goes out once.
 */
export async function sendPaidConfirmation(db: Db, bookingId: string) {
  try {
    const [booking] = await selectManagedBookings(db).where(eq(consultationBookings.id, bookingId)).limit(1);
    if (!booking?.patientName || !booking.patientEmail) return;
    await sendConfirmationEmail(
      createMailer(),
      { ...booking, patientName: booking.patientName, patientEmail: booking.patientEmail },
      siteUrl(`/account/bookings/${booking.id}`),
    );
  } catch (error) {
    console.error(`Confirmation email failed for booking ${bookingId}: ${safeErrorSummary(error)}`);
  }
}
