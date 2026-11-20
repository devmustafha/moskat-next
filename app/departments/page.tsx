import { Phone } from "lucide-react";
import type { Metadata } from "next";
import { DepartmentList } from "@/components/departments/department-list";
import { CtaBand } from "@/components/shared/cta-band";
import { OpeningHours } from "@/components/shared/opening-hours";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { listDepartments } from "@/lib/db/queries";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Departments and services",
  description: "Specialist departments for heart, children’s, women’s, bone and joint, and neurological care, with on-site diagnostics.",
};

export default async function DepartmentsPage() {
  const departments = await listDepartments();
  const withVideo = departments.filter((department) => department.onlineConsultations).length;
  return (
    <>
      <PageHeader
        eyebrow="Departments"
        title={
          <>
            Departments and services, <span className="text-ink-subtle">working as one team.</span>
          </>
        }
        description={`${departments.length} specialist departments under one roof, ${withVideo} of them offering video consultations. You don’t need a referral for most appointments.`}
      />

      <Section tone="surface" aria-label="All departments">
        <DepartmentList departments={departments} headingLevel="h2" />

        <div className="mt-12 grid gap-5 md:mt-16 lg:grid-cols-2">
          <Card className="md:p-10">
            <h2 className="text-h3">Not sure where to start?</h2>
            <p className="mt-3 max-w-copy text-small text-ink-muted">
              Call our patient team and describe your symptoms. A nurse will help you choose the right department
              and the right type of appointment.
            </p>
            <a
              href={siteConfig.contact.phone.href}
              className={buttonClasses({ variant: "outline", withIcon: false, className: "mt-6 gap-2" })}
            >
              <Phone aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
              {siteConfig.contact.phone.label}
            </a>
          </Card>
          <Card className="md:p-10">
            <h2 className="text-h3">Clinic hours</h2>
            <OpeningHours className="mt-4" />
          </Card>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
