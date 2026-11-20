import Link from "next/link";
import { Container } from "@/components/ui/container";

type SectionNavProps = {
  /** Accessible name for the <nav>, e.g. "Your account". */
  label: string;
  links: readonly { label: string; href: string }[];
  /** The current page's href, marked with aria-current="page". */
  current: string;
};

/** Tabs between the pages of one signed-in area. Navigation only: each page checks access itself. */
export function SectionNav({ label, links, current }: SectionNavProps) {
  return (
    <Container className="mb-8">
      <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.href === current ? "page" : undefined}
            className="nav-link shrink-0 aria-[current=page]:bg-surface"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </Container>
  );
}
