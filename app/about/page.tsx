import { HandHeart, type LucideIcon, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { accreditationIcons } from "@/components/shared/accreditation-icons";
import { CtaBand } from "@/components/shared/cta-band";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Photo } from "@/components/ui/photo";
import { SectionHeading } from "@/components/ui/section-heading";
import { listDepartments } from "@/lib/db/queries";
import { accreditations, stats } from "@/lib/data/trust";
import { images } from "@/lib/images";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About us",
  description: `${siteConfig.name} is a specialist hospital offering in-person and online care, with a team that takes time to listen.`,
};


const values: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessagesSquare,
    title: "We listen first",
    text: "Appointments are long enough to tell your whole story. Good diagnosis starts with a good conversation.",
  },
  {
    icon: Users,
    title: "One team around you",
    text: "Specialists, nurses and therapists share one record, so you never have to repeat yourself.",
  },
  {
    icon: HandHeart,
    title: "Clear and honest",
    text: "Plain language, every option explained, and prices shown before you agree to anything.",
  },
  {
    icon: ShieldCheck,
    title: "Safety in everything",
    text: "We follow national standards for quality and safety, and we publish how we’re doing.",
  },
];

function facilitiesFor(departmentCount: number) {
  return [
  "24-hour emergency department",
  `${departmentCount} specialist departments`,
  "On-site laboratory and imaging",
  "Day-surgery theatres",
  "Physiotherapy and rehabilitation gym",
  "Private video consultation rooms",
  ];
}

export default async function AboutPage() {
  const facilities = facilitiesFor((await listDepartments()).length);
  return (
    <>
      <PageHeader
        eyebrow="About us"
        title={
          <>
            A hospital built around people, <span className="text-ink-subtle">not paperwork.</span>
          </>
        }
        description={`For over 30 years, ${siteConfig.name} has cared for families across our community. Today we bring that same care to your home, with video consultations from the specialists you’d see in person.`}
      />

      <section aria-label="Our hospital" className="pb-section">
        <div className="container-site grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="aspect-[4/3] overflow-hidden rounded-panel md:aspect-auto">
            <Photo image={images.waitingRoom} sizes="(min-width: 50.625rem) 58vw, 100vw" priority />
          </div>
          <div className="grid gap-5">
            <div className="aspect-[4/3] overflow-hidden rounded-panel">
              <Photo image={images.hero} sizes="(min-width: 50.625rem) 40vw, 100vw" focus="faces" />
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-panel">
              <Photo image={images.videoConsultation} sizes="(min-width: 50.625rem) 40vw, 100vw" />
            </div>
          </div>
        </div>
      </section>

      <Section tone="surface" aria-labelledby="story-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <h2 id="story-title" className="text-h2">
            Our story <span className="text-ink-subtle">so far.</span>
          </h2>
          <div className="max-w-copy space-y-5 text-body text-ink-muted">
            <p>
              {siteConfig.name} opened as a small community clinic with a simple promise: every patient would be
              seen by someone with the time to listen. As our community grew, so did we, adding specialist
              departments, an emergency department that never closes, and modern diagnostics under one roof.
            </p>
            <p>
              In recent years we’ve added online consultations, so people can see a specialist without taking a day
              off work or travelling while unwell. Video visits are run by the same doctors who see patients on our
              wards, and they share the same record.
            </p>
            <p>What hasn’t changed is the promise. Whether you visit us or call from home, you’ll be heard.</p>
          </div>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 border-y border-line-strong py-10 md:mt-16 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse gap-2">
              <dt className="max-w-[16ch] text-small text-ink-muted">{stat.label}</dt>
              <dd className="text-h2">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section aria-labelledby="values-title">
        <SectionHeading
          id="values-title"
          title={
            <>
              What we stand for, <span className="text-ink-subtle">in every appointment.</span>
            </>
          }
        />
        <Grid cols={4} className="mt-12 md:mt-16">
          {values.map((value) => (
            <div key={value.title} className="rounded-card bg-surface p-6 md:p-7">
              <IconBadge icon={value.icon} className="bg-canvas" />
              <h3 className="mt-6 text-h4">{value.title}</h3>
              <p className="mt-2 text-small text-ink-muted">{value.text}</p>
            </div>
          ))}
        </Grid>
      </Section>

      <Section tone="surface" aria-labelledby="facilities-title">
        <SectionHeading
          id="facilities-title"
          title="Our hospital and accreditations"
          description="Everything you need for diagnosis, treatment and recovery is on one site, with free parking and step-free access throughout."
          action={
            <ButtonLink href="/departments" variant="outline">
              Explore departments
            </ButtonLink>
          }
        />
        <div className="mt-12 grid gap-10 md:mt-16 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-h4">Facilities</h3>
            <ul className="mt-4 divide-y divide-line-strong border-y border-line-strong">
              {facilities.map((facility) => (
                <li key={facility} className="flex items-center gap-3 py-4 text-small">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
                  {facility}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-h4">Accreditations</h3>
            <ul className="mt-4 divide-y divide-line-strong border-y border-line-strong">
              {accreditations.map((item) => {
                const Icon = accreditationIcons[item.icon];
                return (
                  <li key={item.title} className="flex gap-3 py-4">
                    <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
                    <span className="text-small">
                      <span className="block font-medium">{item.title}</span>
                      <span className="text-ink-muted">{item.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
