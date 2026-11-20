import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site";

type CtaBandProps = {
  title?: ReactNode;
  description?: string;
  /** Drop the top padding when the band follows a white (canvas) section that already has bottom padding. */
  flush?: boolean;
};

/** Closing call to action for inner pages: book online, or contact the hospital. */
export function CtaBand({
  title = (
    <>
      Ready to talk to a specialist? <span className="text-white/70">We’re here every day.</span>
    </>
  ),
  description = "Book a video consultation in minutes, or get in touch to arrange a visit to the hospital.",
  flush = false,
}: CtaBandProps) {
  return (
    <section aria-labelledby="cta-title" className={flush ? "pb-section" : "py-section"}>
      <Container>
        <div className="grid gap-8 rounded-panel bg-brand-600 p-8 text-white md:p-12 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-end lg:gap-16">
          <div>
            <h2 id="cta-title" className="text-h2">
              {title}
            </h2>
            <p className="mt-4 max-w-copy text-body text-white/85">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={siteConfig.bookingHref} variant="inverse" className="justify-between sm:justify-center">
              Book an online consultation
            </ButtonLink>
            <ButtonLink
              href="/contact"
              variant="outline"
              withIcon={false}
              className="border-white/35 bg-transparent text-white hover:border-white hover:bg-white/10"
            >
              Contact us
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
