import { forParticipant, NO_STORE } from "@/lib/consultation/http";
import { callStatusOf } from "@/lib/consultation/queries";

/**
 * GET /api/consultations/<bookingId>/status: whether the call has started (both participants
 * were in it) and whether it has ended, for the booking's own patient or doctor (anyone else
 * 404). The call screen polls it (siteConfig.consultation.statusPollSeconds) and asks at once
 * when the other person leaves, so the patient sees "Your doctor ended the consultation".
 *
 * A read-only GET: no Origin check (browsers don't send Origin on same-origin GETs), and
 * cross-site pages can't read the response.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forParticipant(request, id, "status", async (_db, consultation) => Response.json(callStatusOf(consultation), { headers: NO_STORE }), {
    checkOrigin: false,
  });
}
