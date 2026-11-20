import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "brand" | "inverse" | "outline" | "alert";
type Size = "md" | "sm";

type ButtonStyleProps = {
  /**
   * - `primary`: ink pill, the default call to action
   * - `brand`: teal pill, for commerce actions that should stand out (e.g. add to cart)
   * - `inverse`: white pill, for use on dark sections, brand fills or photos
   * - `outline`: hairline pill, for secondary actions
   * - `alert`: red pill, reserved for emergency calls (never for ordinary actions)
   */
  variant?: Variant;
  size?: Size;
  /** Show the circular arrow knob on the right. */
  withIcon?: boolean;
};

const variants: Record<Variant, { button: string; knob: string }> = {
  primary: { button: "bg-ink text-white hover:bg-ink/85", knob: "bg-white text-ink" },
  brand: { button: "bg-brand-600 text-white hover:bg-brand-700", knob: "bg-white text-brand-700" },
  inverse: { button: "bg-white text-ink hover:bg-white/90", knob: "bg-ink text-white" },
  outline: {
    button: "border border-line bg-canvas text-ink hover:border-line-strong hover:bg-surface",
    knob: "bg-brand-50 text-brand-700",
  },
  alert: { button: "bg-alert text-white hover:bg-alert/90", knob: "bg-white text-alert" },
};

const sizes: Record<Size, { withIcon: string; plain: string; knob: string }> = {
  md: { withIcon: "h-12 gap-3 pl-5.5 pr-1.5 text-small", plain: "h-12 px-6 text-small", knob: "size-9" },
  sm: { withIcon: "h-10 gap-2.5 pl-4 pr-1 text-caption", plain: "h-10 px-4.5 text-caption", knob: "size-8" },
};

/** Class names for the pill button, for cases where neither Button nor ButtonLink fits. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  withIcon = true,
  className,
}: ButtonStyleProps & { className?: string } = {}) {
  return cn(
    "group inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap",
    "transition-colors duration-200 ease-out-soft",
    "disabled:pointer-events-none disabled:opacity-50",
    withIcon ? sizes[size].withIcon : sizes[size].plain,
    variants[variant].button,
    className,
  );
}

function Knob({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid place-items-center rounded-full transition-transform duration-300 ease-out-soft group-hover:-rotate-45",
        sizes[size].knob,
        variants[variant].knob,
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type ButtonProps = ComponentProps<"button"> & ButtonStyleProps;

export function Button({ variant, size, withIcon = true, className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, withIcon, className })} {...props}>
      {children}
      {withIcon && <Knob variant={variant} size={size} />}
    </button>
  );
}

type ButtonAnchorProps = ComponentProps<"a"> & ButtonStyleProps;

/** A plain <a> styled as a button, for tel:, mailto: and external links that bypass the router. */
export function ButtonAnchor({ variant, size, withIcon = true, className, children, ...props }: ButtonAnchorProps) {
  return (
    <a className={buttonClasses({ variant, size, withIcon, className })} {...props}>
      {children}
      {withIcon && <Knob variant={variant} size={size} />}
    </a>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & ButtonStyleProps;

export function ButtonLink({ variant, size, withIcon = true, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, withIcon, className })} {...props}>
      {children}
      {withIcon && <Knob variant={variant} size={size} />}
    </Link>
  );
}
