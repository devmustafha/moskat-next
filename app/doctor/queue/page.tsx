import type { Metadata } from "next";
import { ConsultationList } from "@/components/doctor/consultation-list";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireDoctor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { listDoctorQueue } from "@/lib/doctor/queries";
import { formatTimeZoneName, isoDateIn } from "@/lib/format";

export const metadata: Metadata = {
  title: "Consultation queue",
  robots: { index: false, follow: false },
};

/** The signed-in doctor's consultations from today on. Only their own bookings. */
export default async function DoctorQueuePage() {
  const doctor = await requireDoctor("/doctor/queue");
  const now = new Date();
  const { timeZone, bookings } = await listDoctorQueue(await getDb(), doctor, now);

  return (
    <>
      <PageHeader
        title="Consultation queue"
        description={`Today’s and upcoming video consultations, in ${formatTimeZoneName(timeZone, now)}. Patients who booked while signed in link to their page.`}
      />
      <DoctorNav current="/doctor/queue" />
      <Container className="pb-section">
        {bookings.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong p-8 text-center text-small text-ink-muted">
            You have no consultations booked from today onwards.
          </div>
        ) : (
          <ConsultationList bookings={bookings} timeZone={timeZone} todayKey={isoDateIn(now, timeZone)} now={now} />
        )}
      </Container>
    </>
  );
}
