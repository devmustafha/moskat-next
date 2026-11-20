import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const columns = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

type GridProps = ComponentProps<"div"> & {
  /** Columns at the widest breakpoint. Collapses to one column on phones. */
  cols?: keyof typeof columns;
};

/** Responsive card grid: 1 column on phones, stepping up through tablet to `cols` on desktop. */
export function Grid({ cols = 3, className, ...props }: GridProps) {
  return <div className={cn("grid grid-cols-1 gap-4 md:gap-5", columns[cols], className)} {...props} />;
}
