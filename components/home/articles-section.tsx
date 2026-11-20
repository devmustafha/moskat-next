import { ArticleCard } from "@/components/articles/article-card";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { articlesByDate } from "@/lib/data/articles";

export function ArticlesSection() {
  return (
    <Section aria-labelledby="articles-title">
      <SectionHeading
        id="articles-title"
        title={
          <>
            Health advice <span className="text-ink-subtle">from our specialists.</span>
          </>
        }
        description="Plain-language guides written and reviewed by Moskat doctors."
        action={
          <ButtonLink href="/articles" variant="outline">
            All articles
          </ButtonLink>
        }
      />
      <Grid cols={3} className="mt-12 md:mt-16">
        {articlesByDate.slice(0, 3).map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </Grid>
    </Section>
  );
}
