import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireDoctor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { linesToText, PROFILE_LIMITS, paragraphsToText } from "@/lib/doctor/profile";
import { getDoctorEditable } from "@/lib/doctor/queries";
import { formatPrice } from "@/lib/format";
import { centsToAmount } from "@/lib/money";
import { updateDoctorProfileAction, updateDoctorRatesAction } from "../actions";

export const metadata: Metadata = {
  title: "Profile and rates",
  robots: { index: false, follow: false },
};

const hint = "font-normal text-ink-muted";

/** The signed-in doctor edits their public profile text and their consultation fee and length. */
export default async function DoctorProfilePage() {
  const doctor = await requireDoctor("/doctor/profile");
  const editable = await getDoctorEditable(await getDb(), doctor);

  return (
    <>
      <PageHeader
        title="Profile and rates"
        description={
          <>
            What patients see on{" "}
            <Link href={`/doctors/${editable.slug}`} className="link">
              your public profile
            </Link>
            . Your name ({editable.name}), specialty ({editable.specialty}), department and photo are managed by the
            hospital.
          </>
        }
      />
      <DoctorNav current="/doctor/profile" />
      <Container className="grid gap-6 pb-section lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)] lg:items-start">
        <Card>
          <h2 className="text-h3">Profile</h2>
          <ActionForm action={updateDoctorProfileAction} submitLabel="Save profile" className="mt-6 gap-5">
            <label className="grid gap-2 text-caption font-medium">
              Biography
              <textarea
                name="bio"
                rows={8}
                required
                defaultValue={paragraphsToText(editable.bio)}
                className="field"
              />
              <span className={hint}>
                Up to {PROFILE_LIMITS.paragraphs} paragraphs. Leave a blank line between paragraphs.
              </span>
            </label>
            <label className="grid gap-2 text-caption font-medium">
              Qualifications
              <textarea name="qualifications" rows={4} defaultValue={linesToText(editable.qualifications)} className="field" />
              <span className={hint}>One per line.</span>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid content-start gap-2 text-caption font-medium">
                Languages
                <textarea name="languages" rows={4} required defaultValue={linesToText(editable.languages)} className="field" />
                <span className={hint}>One per line.</span>
              </label>
              <label className="grid content-start gap-2 text-caption font-medium">
                Clinical interests
                <textarea name="interests" rows={4} defaultValue={linesToText(editable.interests)} className="field" />
                <span className={hint}>One per line.</span>
              </label>
            </div>
            <label className="grid gap-2 text-caption font-medium sm:max-w-48">
              Years of experience
              <input
                name="yearsExperience"
                type="number"
                min={0}
                max={PROFILE_LIMITS.maxYears}
                step={1}
                required
                defaultValue={editable.yearsExperience}
                className="field"
              />
            </label>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="text-h3">Fee</h2>
          <p className="mt-2 text-small text-ink-muted">
            Now {formatPrice(editable.consultationFeeCents, editable.currency)} for a {editable.consultationMinutes}-minute
            consultation (the same length for every doctor). Changes apply to new bookings; existing bookings keep the fee they
            were booked at.
          </p>
          <ActionForm action={updateDoctorRatesAction} submitLabel="Save fee" className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-caption font-medium">
                Fee ({editable.currency})
                <input
                  name="fee"
                  inputMode="decimal"
                  required
                  defaultValue={centsToAmount(editable.consultationFeeCents)}
                  className="field"
                />
              </label>
            </div>
          </ActionForm>
        </Card>
      </Container>
    </>
  );
}
