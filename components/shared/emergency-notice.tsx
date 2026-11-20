import { Phone, Siren } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

type EmergencyNoticeProps = {
  /**
   * - `panel`: full notice with call buttons. Use wherever someone could book or start an
   *   online consultation (doctor directory, profiles, pricing, FAQ).
   * - `inline`: one-paragraph reminder for tighter spaces (cards, sidebars, article footers).
   */
  variant?: "panel" | "inline";
  className?: string;
};

/** States clearly that online consultations are not for emergencies, and who to call instead. */
export function EmergencyNotice({ variant = "panel", className }: EmergencyNoticeProps) {
  const { emergencyPhone, publicEmergency } = siteConfig.contact;

  if (variant === "inline") {
    return (
      <p
        role="note"
        className={cn("flex items-start gap-3 rounded-field bg-alert-soft p-4 text-small text-alert", className)}
      >
        <Siren aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        <span>
          <strong className="font-semibold">Online consultations are not for emergencies.</strong> If you need urgent
          help, call{" "}
          <a href={publicEmergency.href} className="font-semibold underline underline-offset-2">
            {publicEmergency.label}
          </a>{" "}
          or our 24-hour emergency line on{" "}
          <a href={emergencyPhone.href} className="font-semibold whitespace-nowrap underline underline-offset-2">
            {emergencyPhone.label}
          </a>
          .
        </span>
      </p>
    );
  }

  return (
    <aside
      aria-labelledby="emergency-notice-title"
      className={cn(
        "grid gap-6 rounded-card border border-alert/20 bg-alert-soft p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-8 md:p-8",
        className,
      )}
    >
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-alert text-white">
        <Siren className="size-6" strokeWidth={1.75} />
      </span>
      <div>
        <h2 id="emergency-notice-title" className="text-h4 text-alert">
          Online consultations are not for emergencies
        </h2>
        <p className="mt-2 max-w-copy text-small text-ink">
          If you or someone else has chest pain, difficulty breathing, severe bleeding, signs of a stroke, or has
          collapsed, don’t book online. Call {publicEmergency.label} or our emergency department, open 24 hours a day.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
        <a href={publicEmergency.href} className={buttonClasses({ variant: "alert", withIcon: false, className: "gap-2" })}>
          <Phone aria-hidden="true" className="size-4" strokeWidth={2} />
          Call {publicEmergency.label}
        </a>
        <a
          href={emergencyPhone.href}
          className={buttonClasses({
            variant: "outline",
            withIcon: false,
            className: "gap-2 border-alert/30 text-alert hover:border-alert/50 hover:bg-canvas",
          })}
        >
          <Phone aria-hidden="true" className="size-4" strokeWidth={2} />
          <span>
            <span className="sr-only">Hospital emergency line </span>
            {emergencyPhone.label}
          </span>
        </a>
      </div>
    </aside>
  );
}
