import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href: string };

/** Trail of parent pages; the current page is implied by the <h1> that follows. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
        {items.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-2">
            <Link href={crumb.href} className="link">
              {crumb.label}
            </Link>
            <span aria-hidden="true">/</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type PageHeaderProps = {
  /** Use a <span className="text-ink-subtle"> for the quieter second half of the title. */
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  /** Parent pages, shown as a trail above the title (the current page is implied). */
  breadcrumbs?: Crumb[];
  /** Buttons or other content under the description. */
  children?: ReactNode;
  className?: string;
};

/** The <h1> intro at the top of every inner page. */
export function PageHeader({ title, eyebrow, description, breadcrumbs, children, className }: PageHeaderProps) {
  return (
    <header className={cn("pt-8 pb-12 md:pt-12 md:pb-16", className)}>
      <Container>
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="mb-6" />}
        {eyebrow && <Eyebrow className="mb-6">{eyebrow}</Eyebrow>}
        <h1 className="max-w-4xl text-h1">{title}</h1>
        {description && <p className="mt-6 max-w-copy text-lead text-ink-muted">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </header>
  );
}
