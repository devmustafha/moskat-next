import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconBadgeProps = {
  icon: LucideIcon;
  size?: "md" | "lg";
  className?: string;
};

/** Decorative circular icon on a soft brand tint. Hidden from assistive technology. */
export function IconBadge({ icon: Icon, size = "md", className }: IconBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700",
        size === "md" ? "size-10" : "size-12",
        className,
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-6"} strokeWidth={1.75} />
    </span>
  );
}
