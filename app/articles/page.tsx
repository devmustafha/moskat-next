import type { Metadata } from "next";
import { ArticleCard } from "@/components/articles/article-card";
import { CtaBand } from "@/components/shared/cta-band";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { PageHeader } from "@/components/ui/page-header";
import { articlesByDate } from "@/lib/data/articles";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Health articles",
  description: `Plain-language health advice written and reviewed by ${siteConfig.name} specialists.`,
};

export default function ArticlesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Health articles"
        title={
          <>
            Health advice, <span className="text-ink-subtle">in plain language.</span>
          </>
        }
        description="Guides written and reviewed by our specialists. They’re general information, not a diagnosis; if you’re worried about a symptom, speak to a doctor."
      />

      <Section tone="surface" aria-label="All articles">
        <Grid cols={3}>
          {articlesByDate.map((article) => (
            <ArticleCard key={article.slug} article={article} headingLevel="h2" />
          ))}
        </Grid>
      </Section>

      <CtaBand />
    </>
  );
}
