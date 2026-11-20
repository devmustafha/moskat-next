import { Siren } from "lucide-react";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site";

/** Always-visible emergency notice above the header. */
export function EmergencyBar() {
  const { emergencyPhone } = siteConfig.contact;
  return (
    <aside aria-label="Emergency contact" className="bg-alert text-white">
      <Container
        size="wide"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-2.5 text-center text-caption sm:text-small"
      >
        <Siren aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
        <span className="sm:hidden">24/7 emergency:</span>
        <span className="hidden sm:inline">Medical emergency? Our emergency department is open 24/7.</span>
        <a href={emergencyPhone.href} className="font-semibold underline underline-offset-2 hover:no-underline">
          <span className="hidden sm:inline">Call </span>
          {emergencyPhone.label}
        </a>
      </Container>
    </aside>
  );
}
