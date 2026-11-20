import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import { SectionHeading } from "@/components/ui/section-heading";
import { images } from "@/lib/images";
import { siteConfig } from "@/lib/site";

const steps = [
  {
    title: "Choose a doctor",
    text: "Browse specialists by department, language and availability, then pick a time that suits you.",
  },
  {
    title: "Pick a time and confirm",
    text: "See the full fee and visit length, choose a free slot and confirm in a minute. Your confirmation arrives by email.",
  },
  {
    title: "Join your video call",
    text: "Open the link we send you on your phone or computer at your appointment time. No app to install.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="surface" aria-labelledby="how-title">
      <SectionHeading
        id="how-title"
        title="How online consultations work"
        description="Video visits suit advice, follow-ups, test results and repeat prescriptions. If you need an examination, your doctor will arrange an in-person appointment."
        action={<ButtonLink href={siteConfig.bookingHref}>Book an online consultation</ButtonLink>}
      />

      <div className="mt-12 grid items-center gap-10 md:mt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
        <ol className="border-t border-line-strong">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-b border-line-strong py-7 md:grid-cols-[4.5rem_minmax(0,1fr)] md:py-8"
            >
              <span aria-hidden="true" className="text-h2 leading-none text-brand-600 tabular-nums">
                {index + 1}
              </span>
              <div>
                <h3 className="text-h3">{step.title}</h3>
                <p className="mt-2 max-w-md text-small text-ink-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="aspect-[4/3] overflow-hidden rounded-panel lg:order-first">
          <Photo image={images.videoConsultation} sizes="(min-width: 75rem) 50vw, 100vw" />
        </div>
      </div>

      <EmergencyNotice className="mt-12 md:mt-16" />
    </Section>
  );
}
