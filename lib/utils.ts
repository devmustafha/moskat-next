import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's default scale. Register the custom tokens from
 * app/globals.css so e.g. `text-small` (size) and `text-ink` (colour) aren't treated as
 * conflicting. Keep these lists in sync with the @theme block.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["eyebrow", "caption", "small", "body", "lead", "h4", "h3", "h2", "h1", "display"],
      radius: ["field", "card", "panel"],
      shadow: ["soft"],
      container: ["site", "wide", "copy"],
      spacing: ["gutter", "section"],
      ease: ["out-soft"],
    },
  },
});

/** Merge Tailwind class names, resolving conflicts (e.g. `px-2` vs `px-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
