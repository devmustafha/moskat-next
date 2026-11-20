import type { Metadata } from "next";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { HoursEditor } from "@/components/doctor/hours-editor";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireDoctor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { getDoctorEditable } from "@/lib/doctor/queries";
import { formatTimeZoneName } from "@/lib/format";
import { updateWeeklyHoursAction } from "../actions";

export const metadata: Metadata = {
  title: "Weekly hours",
  robots: { index: false, follow: false },
};

/** The signed-in doctor edits the days and times patients can book video consultations. */
export default async function DoctorHoursPage() {
  const doctor = await requireDoctor("/doctor/hours");
  const now = new Date();
  const editable = await getDoctorEditable(await getDb(), doctor, now);

  return (
    <>
      <PageHeader
        title="Weekly hours"
        description={`The days and times patients can book video consultations with you, in ${formatTimeZoneName(editable.timeZone, now)}. Each consultation is ${editable.consultationMinutes} minutes.`}
      />
      <DoctorNav current="/doctor/hours" />
      <Container className="grid gap-6 pb-section lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:items-start">
        <Card>
          <HoursEditor action={updateWeeklyHoursAction} initial={editable.hours} />
        </Card>
        <Card tone="muted" className="grid gap-3 text-small">
          <h2 className="text-h4">How changes apply</h2>
          <p>New hours apply from today. Patients can only book times inside them.</p>
          <p>Bookings you already have are kept, even if they fall outside your new hours. You’ll see a list of any that do; contact the hospital if they need to be cancelled.</p>
          {editable.hasScheduledHours && (
            <p className="font-medium">Hours the hospital scheduled to start later will be replaced when you save.</p>
          )}
          <p>For time off, contact the hospital.</p>
        </Card>
      </Container>
    </>
  );
}
