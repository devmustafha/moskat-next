import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type EyebrowProps = ComponentProps<"p"> & {
  /** `inverse` for dark sections, brand fills or photos. */
  tone?: "default" | "inverse";
};

/** Small uppercase pill label that introduces a section heading. */
export function Eyebrow({ tone = "default", className, children, ...props }: EyebrowProps) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-eyebrow uppercase",
        tone === "default" ? "border-line bg-canvas text-ink" : "border-white/35 text-white",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", tone === "default" ? "bg-brand-500" : "bg-white")}
      />
      {children}
    </p>
  );
}
