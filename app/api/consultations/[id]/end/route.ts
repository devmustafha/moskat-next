import type { CallEnded } from "@/lib/consultation/call-ui";
import { callError, forParticipant, NO_STORE } from "@/lib/consultation/http";
import { endConsultation } from "@/lib/consultation/queries";

/**
 * POST /api/consultations/<bookingId>/end: the doctor's "End for both". Closes the call, stores
 * its duration and completes the booking (lib/consultation/queries.ts endConsultation). The
 * patient's call screen sees it through the status endpoint and leaves; no token is issued after.
 *
 * The booking's doctor only (its patient: 403 doctor_only; anyone else: 404), and only once the
 * patient has been in the call (409 not_started). Repeating it after the end returns the same result.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forParticipant(request, id, "end", async (db, consultation, now) => {
    if (consultation.role !== "doctor") return callError("doctor_only");
    const result = await endConsultation(db, consultation, now);
    if (!result.ok) return callError(result.reason);
    const body: CallEnded = { status: result.status, endedAt: result.endedAt.toISOString(), durationSeconds: result.durationSeconds };
    return Response.json(body, { headers: NO_STORE });
  });
}
