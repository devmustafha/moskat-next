import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

/** Shown, with status 403, when a signed-in user opens an area their role can't use. */
export default function Forbidden() {
  return (
    <section aria-labelledby="forbidden-title" className="section-y">
      <Container>
        <p className="text-display text-brand-100" aria-hidden="true">
          403
        </p>
        <h1 id="forbidden-title" className="mt-6 text-h1">
          You don’t have access to this page.
        </h1>
        <p className="mt-6 max-w-copy text-lead text-ink-muted">
          This area is for a different type of account. If you think you should have access, please contact the hospital.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/account">Your account</ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
