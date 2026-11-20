import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { requireRole } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { findLinkedDoctorId } from "@/lib/doctor/queries";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Account not linked yet",
  robots: { index: false, follow: false },
};

/** Where `requireDoctor` sends a doctor account that isn't linked to an active doctor profile. Shows no data. */
export default async function DoctorNotLinkedPage() {
  const user = await requireRole("doctor", "/doctor/not-linked");
  if ((await findLinkedDoctorId(await getDb(), user.id)) !== null) redirect("/doctor/queue");
  const { phone } = siteConfig.contact;

  return (
    <section aria-labelledby="not-linked-title" className="section-y">
      <Container>
        <h1 id="not-linked-title" className="text-h1">
          Your account isn’t linked to a doctor profile yet.
        </h1>
        <p className="mt-6 max-w-copy text-lead text-ink-muted">
          Once the hospital links your account to your doctor profile, you’ll see your schedule and consultations here.
          Please contact the hospital to have it set up.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonAnchor href={phone.href}>Call {phone.label}</ButtonAnchor>
          <ButtonLink href="/account" variant="outline">
            Your account
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
