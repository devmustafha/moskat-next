import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const containerSizes = {
  site: "container-site",
  wide: "container-wide",
  bleed: "container-bleed",
} as const;

type ContainerProps = ComponentProps<"div"> & {
  /** `site` (1152px column, default), `wide` (header/bands) or `bleed` (edge-to-edge with a small inset). */
  size?: keyof typeof containerSizes;
};

export function Container({ size = "site", className, ...props }: ContainerProps) {
  return <div className={cn(containerSizes[size], className)} {...props} />;
}

const sectionTones = {
  canvas: "bg-canvas",
  surface: "bg-surface",
  ink: "bg-ink text-white",
} as const;

type SectionProps = ComponentProps<"section"> & {
  /** Background band. Alternate `canvas` and `surface` between neighbouring sections. */
  tone?: keyof typeof sectionTones;
  /** Wraps children in a Container of this size; pass `false` to manage layout yourself. */
  container?: keyof typeof containerSizes | false;
};

/** A page band with the standard vertical rhythm. */
export function Section({
  tone = "canvas",
  container = "site",
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("section-y", sectionTones[tone], className)} {...props}>
      {container ? <Container size={container}>{children}</Container> : children}
    </section>
  );
}
