import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand } from "@/components/shared/cta-band";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { faqGroups } from "@/lib/data/faqs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: `Answers about online consultations, booking, payment, visiting ${siteConfig.name} and your records.`,
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title={
          <>
            Questions, <span className="text-ink-subtle">answered.</span>
          </>
        }
        description={
          <>
            Can’t find what you need? Call us on{" "}
            <a href={siteConfig.contact.phone.href} className="link text-ink">
              {siteConfig.contact.phone.label}
            </a>{" "}
            during clinic hours.
          </>
        }
      >
        <EmergencyNotice />
      </PageHeader>

      <section aria-label="Questions by topic" className="pb-section">
        <Container className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Topics" className="lg:sticky lg:top-8 lg:self-start">
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {faqGroups.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="inline-flex rounded-full bg-surface px-3.5 py-2 text-small text-ink-muted transition-colors hover:text-ink lg:bg-transparent lg:px-0 lg:py-1.5"
                  >
                    {group.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-14">
            {faqGroups.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-8">
                <h2 id={`${group.id}-title`} className="text-h3">
                  {group.title}
                </h2>
                <div className="mt-6 border-t border-line-strong">
                  {group.faqs.map((faq) => (
                    <details key={faq.question} className="group border-b border-line-strong">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-h4 [&::-webkit-details-marker]:hidden">
                        {faq.question}
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface transition-transform duration-300 ease-out-soft group-open:rotate-45"
                        >
                          <Plus className="size-4" />
                        </span>
                      </summary>
                      <p className="max-w-copy pb-6 text-body text-ink-muted">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand flush />
    </>
  );
}
