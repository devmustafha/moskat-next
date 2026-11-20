import { Quote } from "lucide-react";
import { accreditationIcons } from "@/components/shared/accreditation-icons";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { accreditations, stats, type Testimonial, testimonials } from "@/lib/data/trust";
import { cn } from "@/lib/utils";


function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function Attribution({ testimonial, inverse = false }: { testimonial: Testimonial; inverse?: boolean }) {
  return (
    <figcaption className="mt-auto flex items-center gap-3 pt-8">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-caption font-semibold",
          inverse ? "bg-white/15 text-white" : "bg-brand-100 text-brand-800",
        )}
      >
        {initials(testimonial.name)}
      </span>
      <span className="text-small">
        <span className="block font-medium">{testimonial.name}</span>
        <span className={inverse ? "text-white" : "text-ink-muted"}>{testimonial.context}</span>
      </span>
    </figcaption>
  );
}

export function TrustSection() {
  const [featured, ...others] = testimonials;

  return (
    <Section aria-labelledby="trust-title">
      <SectionHeading
        id="trust-title"
        title={
          <>
            Trusted care, <span className="text-ink-subtle">measured by the people we treat.</span>
          </>
        }
      />

      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 border-y py-10 md:mt-16 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-2">
            <dt className="max-w-[16ch] text-small text-ink-muted">{stat.label}</dt>
            <dd className="text-h2">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="sr-only">Patient stories</h3>
      <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {featured && (
          <Card tone="brand" className="rounded-panel p-8 md:p-12">
            <figure className="flex h-full flex-col">
              <Quote aria-hidden="true" className="size-8 fill-current opacity-40" strokeWidth={0} />
              <blockquote className="mt-6 text-h3 font-normal">“{featured.quote}”</blockquote>
              <Attribution testimonial={featured} inverse />
            </figure>
          </Card>
        )}
        <div className="grid gap-5">
          {others.map((testimonial) => (
            <Card key={testimonial.name} tone="muted">
              <figure className="flex h-full flex-col">
                <blockquote className="text-body">“{testimonial.quote}”</blockquote>
                <Attribution testimonial={testimonial} />
              </figure>
            </Card>
          ))}
        </div>
      </div>

      <h3 className="sr-only">Accreditations</h3>
      <ul className="mt-12 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {accreditations.map((item) => {
          const Icon = accreditationIcons[item.icon];
          return (
            <li key={item.title} className="flex gap-3">
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
              <span className="text-small">
                <span className="block font-medium">{item.title}</span>
                <span className="text-ink-muted">{item.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
