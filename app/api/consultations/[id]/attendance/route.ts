import { consultationWindow } from "@/lib/consultation/access";
import { callError, forParticipant, NO_STORE } from "@/lib/consultation/http";
import type { AttendanceEvent } from "@/lib/consultation/lifecycle";
import { recordAttendance } from "@/lib/consultation/queries";

/**
 * POST /api/consultations/<bookingId>/attendance with `{ "event": "joined" | "left" }`: the call
 * screen reports that this participant is now in the call (after Agora let them in) or has left
 * (Leave, closing the tab, a dropped call). Answers 204.
 *
 * Only the booking's own patient or doctor (anyone else 404), only once a token was issued for
 * the call (409 no_call), and "joined" only while the call is open: not after it ended (409) or
 * past the hard stop (403 closed). "left" is always accepted and does nothing once the call ended.
 * When the second person joins while the first is there, the booking becomes `in_progress`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS: readonly AttendanceEvent[] = ["joined", "left"];

async function readEvent(request: Request): Promise<AttendanceEvent | null> {
  const text = await request.text().catch(() => "");
  if (text.length > 200) return null;
  try {
    const event = (JSON.parse(text) as { event?: unknown } | null)?.event;
    return EVENTS.find((e) => e === event) ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await readEvent(request);
  if (!event) return callError("bad_request");

  return forParticipant(request, id, "attendance", async (db, consultation, now) => {
    if (!consultation.call) return callError("no_call");
    if (event === "joined") {
      const over = consultation.call.endedAt !== null || (consultation.status !== "confirmed" && consultation.status !== "in_progress");
      if (over) return callError("ended");
      if (now >= consultationWindow(consultation).hardStopAt) return callError("closed");
    }
    await recordAttendance(db, consultation, event, now);
    return new Response(null, { status: 204, headers: NO_STORE });
  });
}
