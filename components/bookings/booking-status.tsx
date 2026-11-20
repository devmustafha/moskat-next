import type { BookingStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const statuses = {
  pending_payment: { label: "Awaiting payment", tone: "bg-surface text-ink" },
  confirmed: { label: "Confirmed", tone: "bg-brand-50 text-brand-700" },
  in_progress: { label: "In progress", tone: "bg-brand-600 text-white" },
  completed: { label: "Completed", tone: "bg-surface text-ink" },
  cancelled: { label: "Cancelled", tone: "bg-alert-soft text-alert" },
  no_show: { label: "Missed", tone: "bg-surface text-ink" },
} as const satisfies Record<BookingStatus, { label: string; tone: string }>;

/** Booking status as a small pill, in the words patients see. */
export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const { label, tone } = statuses[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-caption font-medium", tone, className)}>{label}</span>;
}
