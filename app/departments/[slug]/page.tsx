import { MapPin, Phone, Video } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { departmentIcons } from "@/components/departments/department-icon";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { CtaBand } from "@/components/shared/cta-band";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { getDepartmentBySlug, getDoctorsByDepartment } from "@/lib/db/queries";
import { siteConfig } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const department = await getDepartmentBySlug((await params).slug);
  if (!department) return {};
  return { title: department.name, description: department.summary };
}

export default async function DepartmentPage({ params }: Props) {
  const department = await getDepartmentBySlug((await params).slug);
  if (!department) notFound();

  const team = await getDoctorsByDepartment(department.slug);
  const { phone } = siteConfig.contact;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Departments", href: "/departments" }]}
        title={department.name}
        description={department.intro}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {department.onlineConsultations && team.length > 0 && (
            <ButtonLink href={`/doctors?department=${department.slug}`} className="justify-between sm:justify-center">
              Book a video consultation
            </ButtonLink>
          )}
          <a href={phone.href} className={buttonClasses({ variant: "outline", withIcon: false, className: "gap-2" })}>
            <Phone aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
            Call to book a visit
          </a>
        </div>
      </PageHeader>

      <Section tone="surface" aria-labelledby="services-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 id="services-title" className="text-h2">
              Services
            </h2>
            <ul className="mt-8 border-t border-line-strong">
              {department.services.map((service) => (
                <li key={service.name} className="grid gap-2 border-b border-line-strong py-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
                  <h3 className="text-h4">{service.name}</h3>
                  <p className="text-small text-ink-muted">{service.description}</p>
                </li>
              ))}
            </ul>
          </div>

          <Card className="self-start md:p-8">
            <IconBadge icon={departmentIcons[department.icon]} size="lg" />
            <h2 className="mt-6 text-h4">At a glance</h2>
            <dl className="mt-4 divide-y border-y text-small">
              <div className="flex items-start gap-3 py-4">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                <div>
                  <dt className="font-medium">Where to find us</dt>
                  <dd className="text-ink-muted">{department.location}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 py-4">
                <Video aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                <div>
                  <dt className="font-medium">Video consultations</dt>
                  <dd className="text-ink-muted">
                    {department.onlineConsultations ? "Available every day" : "In-person appointments only"}
                  </dd>
                </div>
              </div>
              <div className="py-4">
                <dt className="font-medium">Common reasons people see us</dt>
                <dd className="mt-3">
                  <ul className="flex flex-wrap gap-2">
                    {department.conditions.map((condition) => (
                      <li key={condition} className="rounded-full bg-surface px-3 py-1.5 text-caption">
                        {condition}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </Section>

      {team.length > 0 && (
        <Section aria-labelledby="team-title">
          <SectionHeading
            id="team-title"
            title={
              <>
                Meet the team <span className="text-ink-subtle">in {department.name.toLowerCase()}.</span>
              </>
            }
            description="Every doctor’s fee and visit length is shown before you book."
          />
          <Grid cols={4} className="mt-12 grid-cols-2 gap-x-4 gap-y-12 md:mt-16 md:gap-x-5 md:gap-y-14">
            {team.map((doctor) => (
              <DoctorCard key={doctor.slug} doctor={doctor} />
            ))}
          </Grid>
        </Section>
      )}

      <div className={team.length > 0 ? "pb-section" : "py-section"}>
        <div className="container-site">
          <EmergencyNotice />
        </div>
      </div>

      <CtaBand flush />
    </>
  );
}
