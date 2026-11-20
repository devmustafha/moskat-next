import { CalendarDays, GraduationCap, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/articles/article-card";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorPortrait } from "@/components/doctors/doctor-portrait";
import { CtaBand } from "@/components/shared/cta-band";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Grid } from "@/components/ui/grid";
import { Breadcrumbs } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { articlesByDate } from "@/lib/data/articles";
import { getDepartmentBySlug, getDoctorBySlug, getDoctorsByDepartment } from "@/lib/db/queries";
import { formatPrice } from "@/lib/format";
import { siteConfig } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doctor = await getDoctorBySlug((await params).slug);
  if (!doctor) return {};
  return {
    title: `${doctor.name}, ${doctor.specialty}`,
    description: `${doctor.name} is a ${doctor.specialty.toLowerCase()} at ${siteConfig.name} with ${doctor.yearsExperience} years’ experience. Video consultations ${formatPrice(doctor.consultationFeeCents, doctor.currency)} for ${doctor.consultationMinutes} minutes.`,
  };
}

export default async function DoctorProfilePage({ params }: Props) {
  const doctor = await getDoctorBySlug((await params).slug);
  if (!doctor) notFound();

  const [department, team] = await Promise.all([
    getDepartmentBySlug(doctor.department),
    getDoctorsByDepartment(doctor.department),
  ]);
  const colleagues = team.filter((other) => other.slug !== doctor.slug);
  const written = articlesByDate.filter((article) => article.author === doctor.slug);
  const { phone } = siteConfig.contact;
  const canBook = doctor.videoDays.length > 0;

  const facts = [
    { label: "Experience", value: `${doctor.yearsExperience} years` },
    { label: "Languages", value: doctor.languages.join(", ") },
    { label: "Video visit", value: `${doctor.consultationMinutes} minutes` },
  ];

  return (
    <>
      <section aria-labelledby="doctor-name" className="pt-8 pb-section md:pt-12">
        <Container>
          <Breadcrumbs items={[{ label: "Doctors", href: "/doctors" }]} className="mb-8" />
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div className="mx-auto w-full max-w-sm md:max-w-none">
              <DoctorPortrait doctor={doctor} sizes="(min-width: 50.625rem) 38vw, 90vw" priority />
            </div>

            <div>
              {department && (
                <Eyebrow>
                  <Link href={`/departments/${department.slug}`} className="hover:text-brand-700">
                    {department.name}
                  </Link>
                </Eyebrow>
              )}
              <h1 id="doctor-name" className="mt-6 text-h1">
                {doctor.name}
              </h1>
              <p className="mt-4 text-lead text-ink-muted">{doctor.specialty}</p>

              <dl className="mt-8 grid grid-cols-2 gap-4 border-t pt-6 sm:grid-cols-3">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex flex-col-reverse gap-1">
                    <dt className="text-caption text-ink-muted">{fact.label}</dt>
                    <dd className="text-h4 font-normal">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <Card className="mt-8 grid gap-6 md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <p>
                    <span className="block text-caption text-ink-muted">Video consultation fee</span>
                    <span className="text-h2">{formatPrice(doctor.consultationFeeCents, doctor.currency)}</span>
                  </p>
                  <p className="flex items-center gap-2 text-small text-ink-muted">
                    <CalendarDays aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
                    <span>
                      <span className="sr-only">Video visits on </span>
                      {canBook ? doctor.videoDays.join(", ") : "No video hours at the moment"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {canBook && (
                    <ButtonLink href={`/doctors/${doctor.slug}/book`} className="justify-between sm:justify-center">
                      Book a video consultation
                    </ButtonLink>
                  )}
                  <ButtonAnchor href={phone.href} variant="outline" withIcon={false} className="gap-2">
                    <Phone aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
                    Call to book
                  </ButtonAnchor>
                </div>
                <EmergencyNotice variant="inline" />
              </Card>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="surface" aria-label={`About ${doctor.name}`}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="text-h3">About {doctor.name}</h2>
            <div className="mt-5 max-w-copy space-y-4 text-body text-ink-muted">
              {doctor.bio.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <h3 className="mt-10 text-h4">Clinical interests</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {doctor.interests.map((interest) => (
                <li key={interest} className="rounded-full bg-canvas px-3.5 py-2 text-small">
                  {interest}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-h3">Qualifications</h2>
            <ul className="mt-5 divide-y divide-line-strong border-y border-line-strong">
              {doctor.qualifications.map((qualification) => (
                <li key={qualification} className="flex items-start gap-3 py-4 text-small">
                  <GraduationCap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                  {qualification}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {written.length > 0 && (
        <Section aria-labelledby="written-title">
          <SectionHeading id="written-title" title={`Articles by ${doctor.name}`} />
          <Grid cols={3} className="mt-10">
            {written.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </Grid>
        </Section>
      )}

      {colleagues.length > 0 && department && (
        <Section tone={written.length > 0 ? "surface" : "canvas"} aria-labelledby="colleagues-title">
          <SectionHeading id="colleagues-title" title={`More doctors in ${department.name.toLowerCase()}`} />
          <Grid cols={4} className="mt-10 grid-cols-2 gap-x-4 gap-y-12 md:gap-x-5 md:gap-y-14">
            {colleagues.map((colleague) => (
              <DoctorCard key={colleague.slug} doctor={colleague} />
            ))}
          </Grid>
        </Section>
      )}

      {/* Bands alternate grey/white after the grey About section, so exactly one extra band ends on white. */}
      <CtaBand flush={(written.length > 0) !== (colleagues.length > 0)} />
    </>
  );
}
