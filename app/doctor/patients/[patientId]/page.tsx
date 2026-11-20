import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConsultationList } from "@/components/doctor/consultation-list";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireDoctor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { getDoctorPatient } from "@/lib/doctor/queries";

export const metadata: Metadata = {
  title: "Patient",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ patientId: string }> };

/**
 * A patient of the signed-in doctor: needs a non-cancelled booking between them. Anyone else is
 * a 404, so the page never reveals whether a patient exists. Shows only this doctor's bookings.
 */
export default async function DoctorPatientPage({ params }: Props) {
  const { patientId } = await params;
  const doctor = await requireDoctor(`/doctor/patients/${encodeURIComponent(patientId)}`);
  const patient = await getDoctorPatient(await getDb(), doctor, patientId);
  if (!patient) notFound();

  return (
    <>
      <PageHeader
        title={patient.name}
        breadcrumbs={[{ label: "Consultation queue", href: "/doctor/queue" }]}
        description="Your consultations with this patient. Bookings with other doctors aren’t shown."
      />
      <Container className="grid gap-8 pb-section">
        <Card className="max-w-xl">
          <dl className="grid gap-4 text-small">
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="mt-1 font-medium">
                <a href={`mailto:${patient.email}`} className="link">
                  {patient.email}
                </a>
              </dd>
            </div>
          </dl>
        </Card>
        <ConsultationList bookings={patient.bookings} timeZone={patient.timeZone} linkPatients={false} />
      </Container>
    </>
  );
}
