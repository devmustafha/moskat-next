import { ArrowUpRight, Mail, MapPin, Phone, Siren } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { OpeningHours } from "@/components/shared/opening-hours";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import { SectionHeading } from "@/components/ui/section-heading";
import { images } from "@/lib/images";
import { siteConfig } from "@/lib/site";

export function VisitSection() {
  const { contact } = siteConfig;
  return (
    <Section id="visit" tone="surface" aria-labelledby="visit-title">
      <SectionHeading
        id="visit-title"
        title={
          <>
            Easy to find, <span className="text-ink-subtle">calm when you arrive.</span>
          </>
        }
        description="Free parking on site, step-free access throughout, and a quiet waiting area for families."
        action={
          <ButtonLink href="/contact" variant="outline">
            Map and directions
          </ButtonLink>
        }
      />

      <div className="mt-12 grid gap-5 md:mt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="aspect-[4/3] overflow-hidden rounded-panel lg:aspect-auto lg:min-h-full">
          <Photo image={images.waitingRoom} sizes="(min-width: 75rem) 50vw, 100vw" />
        </div>

        <Card className="grid gap-8 md:p-10">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 text-small font-medium">
                <MapPin aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
                Address
              </h3>
              <address className="mt-2 text-small not-italic text-ink-muted">
                {contact.address[0]}
                <br />
                {contact.address[1]}
              </address>
              <a
                href={contact.directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="link mt-3 inline-flex items-center gap-1 text-small font-medium"
              >
                Get directions
                <ArrowUpRight aria-hidden="true" className="size-4" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
            <div>
              <h3 className="text-small font-medium">Contact</h3>
              <ul className="mt-2 space-y-2 text-small text-ink-muted">
                <li className="flex items-center gap-2">
                  <Phone aria-hidden="true" className="size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                  <a href={contact.phone.href} className="link">
                    {contact.phone.label}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail aria-hidden="true" className="size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                  <a href={contact.email.href} className="link">
                    {contact.email.label}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-small font-medium">Opening hours</h3>
            <OpeningHours className="mt-3" />
          </div>

          <p className="flex items-start gap-3 rounded-field bg-alert-soft p-4 text-small text-alert">
            <Siren aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <span>
              In a life-threatening emergency, call{" "}
              <a href={contact.emergencyPhone.href} className="font-semibold underline underline-offset-2">
                {contact.emergencyPhone.label}
              </a>{" "}
              or your local emergency number. Our emergency department never closes.
            </span>
          </p>
        </Card>
      </div>
    </Section>
  );
}
