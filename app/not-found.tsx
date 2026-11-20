import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="section-y">
      <Container>
        <p className="text-display text-brand-100" aria-hidden="true">
          404
        </p>
        <h1 id="not-found-title" className="mt-6 text-h1">
          We can’t find that page.
        </h1>
        <p className="mt-6 max-w-copy text-lead text-ink-muted">
          It may have moved, or the link may be out of date. If you need urgent medical help, call{" "}
          <a href={siteConfig.contact.emergencyPhone.href} className="link font-medium text-ink">
            {siteConfig.contact.emergencyPhone.label}
          </a>
          .
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/doctors" variant="outline">
            Find a doctor
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
