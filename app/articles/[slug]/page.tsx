import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/articles/article-card";
import { DoctorPortrait } from "@/components/doctors/doctor-portrait";
import { CtaBand } from "@/components/shared/cta-band";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { Breadcrumbs } from "@/components/ui/page-header";
import { type ArticleBlock, articles, articlesByDate, getArticle } from "@/lib/data/articles";
import { getDoctorBySlug } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticle((await params).slug);
  if (!article) return {};
  return { title: article.title, description: article.excerpt };
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="pt-6 text-h3 text-ink">{block.text}</h2>;
    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-brand-500" />
              {item}
            </li>
          ))}
        </ul>
      );
    default:
      return <p>{block.text}</p>;
  }
}

export default async function ArticlePage({ params }: Props) {
  const article = getArticle((await params).slug);
  if (!article) notFound();

  const author = await getDoctorBySlug(article.author);
  const more = articlesByDate.filter((other) => other.slug !== article.slug).slice(0, 3);

  return (
    <>
      <article aria-labelledby="article-title" className="pt-8 pb-section md:pt-12">
        <Container>
          <Breadcrumbs items={[{ label: "Health articles", href: "/articles" }]} className="mb-8" />
          <header className="max-w-4xl">
            <p className="inline-flex rounded-full bg-brand-50 px-3 py-1.5 text-caption font-medium text-brand-700">
              {article.category}
            </p>
            <h1 id="article-title" className="mt-6 text-h1">
              {article.title}
            </h1>
            <p className="mt-6 max-w-copy text-lead text-ink-muted">{article.excerpt}</p>
            <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-6 text-small text-ink-muted">
              {author && (
                <>
                  <span className="text-ink">
                    By{" "}
                    <Link href={`/doctors/${author.slug}`} className="link font-medium">
                      {author.name}
                    </Link>
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <time dateTime={article.published}>{formatDate(article.published)}</time>
              <span aria-hidden="true">·</span>
              <span>{article.readMinutes} min read</span>
            </p>
          </header>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
            <div className="max-w-copy space-y-5 text-body text-ink-muted md:text-lead">
              {article.body.map((block, index) => (
                // Blocks are static content in a fixed order, so the index is a stable key.
                <Block key={index} block={block} />
              ))}
              <p className="border-t pt-6 text-small">
                This article is general information, not medical advice. It can’t replace a consultation with a
                doctor who knows your history.
              </p>
            </div>

            <aside aria-label="About this article" className="grid content-start gap-5 lg:sticky lg:top-8 lg:self-start">
              {author && (
                <Card className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-4 p-4 md:p-5">
                  <DoctorPortrait doctor={author} sizes="80px" />
                  <div>
                    <p className="text-caption text-ink-muted">Written by</p>
                    <p className="text-small font-medium">{author.name}</p>
                    <p className="text-caption text-ink-muted">{author.specialty}</p>
                  </div>
                  <ButtonLink href={`/doctors/${author.slug}`} variant="outline" size="sm" className="col-span-2 justify-between">
                    View profile and book
                  </ButtonLink>
                </Card>
              )}
              <EmergencyNotice variant="inline" />
            </aside>
          </div>
        </Container>
      </article>

      {more.length > 0 && (
        <Section tone="surface" aria-labelledby="more-title">
          <h2 id="more-title" className="text-h2">
            More health articles
          </h2>
          <Grid cols={3} className="mt-10">
            {more.map((other) => (
              <ArticleCard key={other.slug} article={other} />
            ))}
          </Grid>
        </Section>
      )}

      <CtaBand flush={more.length === 0} />
    </>
  );
}
