import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  /** Optional pill label. Use sparingly: only where it adds context the title doesn't. */
  eyebrow?: string;
  /** Use a <span className="text-ink-subtle"> for the quieter second half of the title. */
  title: ReactNode;
  /** id for the <h2>, so the parent section can reference it with aria-labelledby. */
  id: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Section intro: eyebrow and title on the left, description and action on the right from desktop up. */
export function SectionHeading({ eyebrow, title, id, description, action, className }: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:gap-16",
        className,
      )}
    >
      <div>
        {eyebrow && <Eyebrow className="mb-5">{eyebrow}</Eyebrow>}
        <h2 id={id} className="text-h2">
          {title}
        </h2>
      </div>
      {(description || action) && (
        <div>
          {description && <p className="max-w-copy text-body text-ink-muted">{description}</p>}
          {action && <div className="mt-6">{action}</div>}
        </div>
      )}
    </div>
  );
}
