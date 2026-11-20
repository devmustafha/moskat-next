import { CheckCircle2, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

/** The result of an admin action whose form is no longer on the page. */
export function AdminNotice({ tone = "success", children }: { tone?: "success" | "warning"; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;
  return (
    <Container className="mb-6">
      <p
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-field p-4 text-small",
          tone === "success" ? "bg-brand-50 text-brand-800" : "bg-alert-soft text-alert",
        )}
      >
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        <span>{children}</span>
      </p>
    </Container>
  );
}
