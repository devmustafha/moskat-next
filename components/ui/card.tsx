import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  /** White card with hairline border: the default for products, features and forms. */
  default: "border border-line bg-canvas",
  /** Borderless grey card for use on white sections. */
  muted: "bg-surface",
  /** Teal fill for the single highlighted item in a group (e.g. a recommended product). */
  brand: "bg-brand-600 text-white",
  /** Translucent panel for use on photos or brand fills. */
  glass: "glass text-white",
} as const;

type CardProps = ComponentProps<"div"> & {
  tone?: keyof typeof tones;
};

export function Card({ tone = "default", className, ...props }: CardProps) {
  return <div className={cn("rounded-card p-6 md:p-7", tones[tone], className)} {...props} />;
}
