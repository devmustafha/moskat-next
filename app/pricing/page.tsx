import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/shared/cta-band";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCatalogueStats, listDepartments, listDoctors } from "@/lib/db/queries";
import { healthChecks, paymentNotes, priceGroups } from "@/lib/data/pricing";
import { formatPrice } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent self-pay prices for video consultations, in-person appointments, tests, imaging and health checks.",
};

export default async function PricingPage() {
  const [doctors, departments, stats] = await Promise.all([listDoctors(), listDepartments(), getCatalogueStats()]);
  const departmentName = new Map(departments.map((department) => [department.slug, department.name]));
  const byFee = [...doctors].sort(
    (a, b) => a.consultationFeeCents - b.consultationFeeCents || a.name.localeCompare(b.name),
  );
  const bookHealthCheck = (name: string) =>
    `${siteConfig.contact.email.href}?subject=${encodeURIComponent(`${name} health check`)}`;

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title={
          <>
            Clear prices, <span className="text-ink-subtle">agreed before anything happens.</span>
          </>
        }
        description={`Video consultations from ${formatPrice(stats.lowestFeeCents)}. Every price below is the full self-pay price, including the specialist’s report. If you’re insured, we’ll check your cover first.`}
      >
        <EmergencyNotice />
      </PageHeader>

      <Section tone="surface" aria-labelledby="video-title">
        <SectionHeading
          id="video-title"
          title="Video consultations"
          description="Each doctor sets their own fee, shown here and on their profile. Your booking is confirmed straight away; our patient team sends payment details before the call."
          action={<ButtonLink href="/doctors">Find a doctor</ButtonLink>}
        />
        <div className="mt-12 overflow-x-auto rounded-card border bg-canvas md:mt-16">
          <table className="w-full min-w-[36rem] text-left text-small">
            <caption className="sr-only">Video consultation fees by doctor</caption>
            <thead className="border-b text-caption text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium md:px-7">Doctor</th>
                <th scope="col" className="px-5 py-4 font-medium">Department</th>
                <th scope="col" className="px-5 py-4 font-medium">Length</th>
                <th scope="col" className="px-5 py-4 text-right font-medium md:px-7">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {byFee.map((doctor) => (
                <tr key={doctor.slug}>
                  <th scope="row" className="px-5 py-4 font-medium md:px-7">
                    <Link href={`/doctors/${doctor.slug}`} className="link">
                      {doctor.name}
                    </Link>
                    <span className="block font-normal text-ink-muted">{doctor.specialty}</span>
                  </th>
                  <td className="px-5 py-4 text-ink-muted">{departmentName.get(doctor.department)}</td>
                  <td className="px-5 py-4 text-ink-muted">{doctor.consultationMinutes} min</td>
                  <td className="px-5 py-4 text-right text-h4 font-normal md:px-7">{formatPrice(doctor.consultationFeeCents, doctor.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section aria-labelledby="health-checks-title">
        <SectionHeading
          id="health-checks-title"
          title={
            <>
              Health checks, <span className="text-ink-subtle">all in one visit.</span>
            </>
          }
          description="Tests in the morning, results with a doctor the same week. Most checks take two to three hours."
        />
        <Grid cols={3} className="mt-12 md:mt-16">
          {healthChecks.map((check) => (
            <Card key={check.name} tone={check.featured ? "brand" : "default"} className="flex flex-col md:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-h4">{check.name}</h3>
                {check.featured && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-caption font-medium text-brand-700">Most chosen</span>
                )}
              </div>
              <p className={cn("mt-2 text-small", check.featured ? "text-white/85" : "text-ink-muted")}>{check.summary}</p>
              <p className="mt-6 text-h2">{formatPrice(check.price)}</p>
              <ul className={cn("mt-6 space-y-3 border-t pt-6 text-small", check.featured && "border-white/25")}>
                {check.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check
                      aria-hidden="true"
                      className={cn("mt-0.5 size-4 shrink-0", check.featured ? "text-white" : "text-brand-700")}
                      strokeWidth={2}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <ButtonAnchor
                  href={bookHealthCheck(check.name)}
                  variant={check.featured ? "inverse" : "outline"}
                  className="w-full justify-between"
                >
                  Book {check.name.toLowerCase()} check
                </ButtonAnchor>
              </div>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section tone="surface" aria-labelledby="price-list-title">
        <h2 id="price-list-title" className="text-h2">
          Appointments and tests
        </h2>
        <div className="mt-12 grid items-start gap-5 md:mt-16 lg:grid-cols-2">
          {priceGroups.map((group) => (
            <Card key={group.id} className="md:p-8">
              <h3 className="text-h3">{group.title}</h3>
              <p className="mt-2 text-small text-ink-muted">{group.description}</p>
              <dl className="mt-6 divide-y border-y">
                {group.items.map((item) => (
                  <div key={item.name} className="flex items-baseline justify-between gap-6 py-4">
                    <dt className="text-small">
                      <span className="block font-medium">{item.name}</span>
                      <span className="text-ink-muted">{item.detail}</span>
                    </dt>
                    <dd className="shrink-0 text-right text-h4 font-normal">
                      {item.from && <span className="mr-1 text-caption text-ink-muted">from</span>}
                      {formatPrice(item.price)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>

        <ul className="mt-12 grid gap-8 md:mt-16 md:grid-cols-3">
          {paymentNotes.map((note) => (
            <li key={note.title}>
              <h3 className="text-h4">{note.title}</h3>
              <p className="mt-2 text-small text-ink-muted">{note.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-caption text-ink-muted">
          Emergency care is never delayed for payment. Prices are for self-paying patients and may change; the price
          confirmed when you book is the price you pay.
        </p>
      </Section>

      <CtaBand />
    </>
  );
}
