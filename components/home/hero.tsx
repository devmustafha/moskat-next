import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Photo } from "@/components/ui/photo";
import { getCatalogueStats, listDoctors } from "@/lib/db/queries";
import { formatPrice } from "@/lib/format";
import { images } from "@/lib/images";
import { siteConfig } from "@/lib/site";

export async function Hero() {
  const [doctors, stats] = await Promise.all([listDoctors(), getCatalogueStats()]);
  const onlineHours = siteConfig.hours.find((entry) => entry.service === "Online consultations")?.times[0];
  const facts = [
    { value: formatPrice(stats.lowestFeeCents), label: "Video visits from" },
    { value: `${siteConfig.booking.consultationMinutes} min`, label: "Every video visit" },
    { value: "24/7", label: "Emergency care" },
  ];

  return (
    <section aria-labelledby="hero-title" className="pt-8 pb-section md:pt-12">
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Eyebrow>{siteConfig.tagline}</Eyebrow>
          <h1 id="hero-title" className="mt-6 text-h1">
            Expert care that listens, <span className="block text-ink-subtle">in person or online.</span>
          </h1>
          <p className="mt-6 max-w-copy text-lead text-ink-muted">
            See a specialist from home by video, or visit us for diagnostics, treatment and recovery. One team,
            with your whole story in view.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={siteConfig.bookingHref} className="justify-between sm:justify-center">
              Book an online consultation
            </ButtonLink>
            <ButtonLink href="/departments" variant="outline" className="justify-between sm:justify-center">
              Explore departments
            </ButtonLink>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t pt-6">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col-reverse gap-1">
                <dt className="text-caption text-ink-muted">{fact.label}</dt>
                <dd className="text-h3 font-normal">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="aspect-[4/5] overflow-hidden rounded-panel bg-surface sm:aspect-[5/4] lg:aspect-[8/9]">
            <Photo image={images.hero} sizes="(min-width: 75rem) 40vw, 100vw" priority focus="faces" />
          </div>
          {onlineHours && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-4 rounded-card bg-canvas/95 p-3 pr-5 shadow-soft backdrop-blur sm:inset-x-auto sm:bottom-5 sm:left-5">
              <div className="flex shrink-0 -space-x-2.5">
                {doctors.flatMap((doctor) =>
                  doctor.photo
                    ? [
                        <span key={doctor.slug} className="size-10 overflow-hidden rounded-full bg-surface ring-2 ring-canvas">
                          <Photo image={doctor.photo} sizes="40px" focus="faces" decorative />
                        </span>,
                      ]
                    : [],
                )}
              </div>
              <p className="text-small leading-snug">
                <span className="block font-medium">Video visits daily</span>
                <span className="text-ink-muted">{onlineHours.hours}</span>
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
