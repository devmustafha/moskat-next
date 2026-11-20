import { Accessibility, ArrowUpRight, Bus, Car, Mail, MapPin, Phone, Siren, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { OpeningHours } from "@/components/shared/opening-hours";
import { ButtonAnchor } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact, location and opening hours",
  description: `How to reach ${siteConfig.name}: phone, email, address, map, directions and opening hours for every service.`,
};

// Placeholder travel details: replace with the hospital's real parking and transit information.
const gettingHere = [
  { icon: Car, title: "By car", text: "Free parking on site, with accessible bays beside every entrance." },
  { icon: Bus, title: "By bus", text: "Routes 4, 12 and 27 stop outside the main entrance on Riverside Avenue." },
  {
    icon: Accessibility,
    title: "Accessibility",
    text: "Step-free access, lifts and accessible toilets in every building. Wheelchairs at main reception.",
  },
];

export default function ContactPage() {
  const { contact } = siteConfig;
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title={
          <>
            Get in touch, <span className="text-ink-subtle">or come and see us.</span>
          </>
        }
        description="Our patient team answers calls and emails during clinic hours. For anything urgent, use the emergency line, which is staffed around the clock."
      />

      <section aria-label="Ways to contact us" className="pb-section">
        <div className="container-site">
          <Grid cols={4}>
            <Card className="flex flex-col border-alert/20 bg-alert-soft">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-alert text-white">
                <Siren className="size-5" strokeWidth={1.75} />
              </span>
              <h2 className="mt-6 text-h4 text-alert">Emergency, 24/7</h2>
              <p className="mt-2 text-small text-ink">For urgent or life-threatening problems. Never use email or online booking.</p>
              <p className="mt-auto space-y-1 pt-6 text-small font-semibold text-alert">
                <a href={contact.publicEmergency.href} className="block underline underline-offset-2">
                  Call {contact.publicEmergency.label}
                </a>
                <a href={contact.emergencyPhone.href} className="block underline underline-offset-2">
                  {contact.emergencyPhone.label}
                </a>
              </p>
            </Card>
            <Card className="flex flex-col">
              <IconBadge icon={Phone} />
              <h2 className="mt-6 text-h4">Call us</h2>
              <p className="mt-2 text-small text-ink-muted">Appointments, results and general questions.</p>
              <a href={contact.phone.href} className="link mt-auto pt-6 text-small font-medium">
                {contact.phone.label}
              </a>
            </Card>
            <Card className="flex flex-col">
              <IconBadge icon={Mail} />
              <h2 className="mt-6 text-h4">Email us</h2>
              <p className="mt-2 text-small text-ink-muted">We reply within one working day. Please don’t email about urgent symptoms.</p>
              <a href={contact.email.href} className="link mt-auto pt-6 text-small font-medium">
                {contact.email.label}
              </a>
            </Card>
            <Card className="flex flex-col">
              <IconBadge icon={Video} />
              <h2 className="mt-6 text-h4">See a doctor online</h2>
              <p className="mt-2 text-small text-ink-muted">Book a video consultation with a specialist, every day.</p>
              <Link href={siteConfig.bookingHref} className="link mt-auto pt-6 text-small font-medium">
                Find a doctor
              </Link>
            </Card>
          </Grid>
        </div>
      </section>

      <Section id="location" tone="surface" aria-labelledby="location-title">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-h-80 overflow-hidden rounded-panel border border-line-strong bg-surface-strong lg:min-h-[28rem]">
            <iframe
              title={`Map showing ${siteConfig.name} at ${contact.address.join(", ")}`}
              src={contact.mapEmbedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-80 w-full border-0 lg:min-h-[28rem]"
            />
          </div>

          <Card className="flex flex-col md:p-8">
            <h2 id="location-title" className="text-h3">
              Find us
            </h2>
            <address className="mt-4 flex items-start gap-3 text-body not-italic">
              <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
              <span>
                {contact.address[0]}
                <br />
                {contact.address[1]}
              </span>
            </address>
            <ButtonAnchor
              href={contact.directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              withIcon={false}
              className="mt-6 gap-2 self-start"
            >
              Get directions
              <ArrowUpRight aria-hidden="true" className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </ButtonAnchor>

            <h3 className="mt-10 text-small font-medium">Getting here</h3>
            <ul className="mt-3 divide-y border-y">
              {gettingHere.map((item) => (
                <li key={item.title} className="flex gap-3 py-4 text-small">
                  <item.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-ink-muted">{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="hours" aria-labelledby="hours-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-16">
          <div>
            <h2 id="hours-title" className="text-h2">
              Opening hours
            </h2>
            <p className="mt-4 max-w-copy text-body text-ink-muted">
              The emergency department never closes. Clinic and phone lines follow outpatient hours; video
              consultations run every day, including public holidays.
            </p>
          </div>
          <OpeningHours className="text-body" />
        </div>

        <EmergencyNotice className="mt-12 md:mt-16" />
      </Section>
    </>
  );
}
