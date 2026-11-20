import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Article } from "@/lib/data/articles";
import { getDoctorBySlug } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";

type ArticleCardProps = {
  article: Article;
  headingLevel?: "h2" | "h3";
};

/** Text-led article summary that links to the full article. The whole card is clickable. */
export async function ArticleCard({ article, headingLevel: Heading = "h3" }: ArticleCardProps) {
  const author = await getDoctorBySlug(article.author);
  return (
    <article className="group relative flex h-full flex-col rounded-card border bg-canvas p-6 transition-colors duration-200 ease-out-soft hover:border-line-strong md:p-7">
      <p className="flex items-center justify-between gap-4 text-caption text-ink-muted">
        <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">{article.category}</span>
        <span>{article.readMinutes} min read</span>
      </p>
      <Heading className="mt-6 text-h4">
        <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0 after:rounded-card">
          {article.title}
        </Link>
      </Heading>
      <p className="mt-3 text-small text-ink-muted">{article.excerpt}</p>
      <div className="mt-auto flex items-end justify-between gap-4 pt-8 text-caption">
        <p>
          {author && <span className="block font-medium">{author.name}</span>}
          <time dateTime={article.published} className="text-ink-muted">
            {formatDate(article.published)}
          </time>
        </p>
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface transition-colors duration-200 ease-out-soft group-hover:bg-brand-600 group-hover:text-white"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </article>
  );
}
