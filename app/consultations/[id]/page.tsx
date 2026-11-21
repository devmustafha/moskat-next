import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsultationRoom } from "@/components/consultation/consultation-room";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireConsultationActor } from "@/lib/auth/session";
import { consultationWindow, decideAccess } from "@/lib/consultation/access";
import { describeTokenProblem } from "@/lib/consultation/call-ui";
import { findConsultation } from "@/lib/consultation/queries";
import { getDb } from "@/lib/db/server";
import { formatSlot } from "@/lib/format";

export const metadata: Metadata = {
  title: "Video consultation",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/**
 * The video call room for one booking, for its patient or its doctor only (anyone else: 404, as
 * if it didn't exist; admins: 403). This page only decides what to show; every token is still
 * checked by POST /api/consultations/<id>/token.
 */
export default async function ConsultationPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireConsultationActor(`/consultations/${encodeURIComponent(id)}`);
  const consultation = await findConsultation(await getDb(), actor, id);
  if (!consultation) notFound();

  const { role } = consultation;
  const peerName = role === "patient" ? consultation.doctorName : (consultation.patientName ?? "your patient");
  const back =
    role === "patient"
      ? { backHref: `/account/bookings/${consultation.bookingId}`, backLabel: "Back to your booking" }
      : { backHref: "/doctor/queue", backLabel: "Back to your queue" };

  const decision = decideAccess({ role, booking: consultation, call: consultation.call, now: new Date() });
  const { opensAt, hardStopAt } = consultationWindow(consultation);

  return (
    <>
      <PageHeader
        eyebrow="Video consultation"
        breadcrumbs={
          role === "patient"
            ? [
                { label: "Your account", href: "/account" },
                { label: "Your booking", href: back.backHref },
              ]
            : [{ label: "Consultation queue", href: "/doctor/queue" }]
        }
        title={
          <>
            {role === "patient" ? "Your consultation" : "Consultation"} <span className="text-ink-subtle">with {peerName}.</span>
          </>
        }
        description={formatSlot(consultation.startsAt, consultation.timeZone)}
      />
      <Container className="pb-section">
        {decision.ok || decision.reason === "too_early" ? (
          <ConsultationRoom
            bookingId={consultation.bookingId}
            role={role}
            peerName={peerName}
            timeZone={consultation.timeZone}
            startsAt={consultation.startsAt.toISOString()}
            endsAt={consultation.endsAt.toISOString()}
            opensAt={opensAt.toISOString()}
            hardStopAt={hardStopAt.toISOString()}
            {...back}
          />
        ) : (
          <Card tone="muted" className="grid max-w-xl justify-items-start gap-4 md:p-10">
            <h2 className="text-h3">The video call isn’t available</h2>
            <p className="text-small text-ink-muted">{describeTokenProblem(decision.reason, { role, timeZone: consultation.timeZone }).message}</p>
            <Link href={back.backHref} className="link text-small">
              {back.backLabel}
            </Link>
          </Card>
        )}
      </Container>
    </>
  );
}
