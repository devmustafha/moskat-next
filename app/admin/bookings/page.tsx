import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminNotice } from "@/components/admin/admin-notice";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { type AdminBooking, adminActionsFor, type BookingView, listAdminBookings } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { attendanceSummary } from "@/lib/consultation/lifecycle";
import type { PaymentReviewReason } from "@/lib/db/schema";
import { getDb } from "@/lib/db/server";
import { formatPrice, formatSlot } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cancelBookingAsHospitalAction, markNoShowAction, markRefundedAction } from "../actions";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ view?: string; notice?: string; ref?: string }> };

/** Fixed messages for `?notice=`; the URL never supplies the text. */
const notices = {
  cancelled: { tone: "success", text: "cancelled. The patient has been emailed." },
  "cancelled-not-emailed": { tone: "warning", text: "cancelled, but we couldn’t email the patient. Please let them know." },
  "cancelled-refund": { tone: "warning", text: "cancelled and the patient emailed. It was paid: refund it in the Paystack dashboard, then mark it refunded here." },
  "cancelled-refund-not-emailed": {
    tone: "warning",
    text: "cancelled, but we couldn’t email the patient. It was paid: refund it in the Paystack dashboard, mark it refunded, and let the patient know.",
  },
  "no-show": { tone: "success", text: "marked as missed." },
  refunded: { tone: "success", text: "marked as refunded." },
} as const;

const reviewReasonLabels: Record<PaymentReviewReason, string> = {
  cancelled_after_payment: "cancelled after payment",
  booking_not_payable: "paid after the slot was released",
  amount_mismatch: "amount didn’t match",
  currency_mismatch: "currency didn’t match",
};

/** The booking's payment state, in staff terms. */
function PaymentBadge({ payment }: { payment: AdminBooking["payment"] }) {
  if (!payment) return <span className="text-caption text-ink-muted">No online payment</span>;
  const label = {
    initialized: "Not paid",
    failed: "Payment failed",
    succeeded: "Paid",
    refunded: "Refunded",
    needs_review: `Refund due${payment.reviewReason ? ` (${reviewReasonLabels[payment.reviewReason]})` : ""}`,
  }[payment.status];
  const tone = payment.status === "needs_review" ? "bg-alert-soft text-alert" : payment.status === "succeeded" ? "bg-brand-50 text-brand-700" : "bg-surface text-ink";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-caption font-medium", tone)} title={`Paystack reference ${payment.reference}`}>
      {label}
    </span>
  );
}

/** The video call's attendance in one line; in alert colours when staff should act (the doctor didn't join). */
function Attendance({ booking, now }: { booking: AdminBooking; now: Date }) {
  const summary = attendanceSummary({ ...booking, paid: booking.payment?.status === "succeeded" }, booking.call, booking.doctor.timeZone, now);
  if (!summary) return null;
  return <span className={cn("text-caption", summary.alert ? "font-medium text-alert" : "text-ink-muted")}>{summary.text}</span>;
}

const views: { view: BookingView; label: string; href: string }[] = [
  { view: "upcoming", label: "Upcoming", href: "/admin/bookings" },
  { view: "past", label: "Past", href: "/admin/bookings?view=past" },
];

export default async function AdminBookingsPage({ searchParams }: Props) {
  const admin = await requireAdmin("/admin/bookings");
  const params = await searchParams;
  const view: BookingView = params.view === "past" ? "past" : "upcoming";
  const notice = notices[params.notice as keyof typeof notices];
  const reference = params.ref && /^MSK-[A-Z0-9]{1,12}$/.test(params.ref) ? params.ref : null;
  const now = new Date();
  const bookings = await listAdminBookings(await getDb(), admin, view, now);

  return (
    <>
      <PageHeader title="Bookings" description="All online consultations. Cancelling emails the patient; the slot is released straight away." />
      <AdminNav current="/admin/bookings" />
      {notice && reference && (
        <AdminNotice tone={notice.tone}>
          Booking {reference} {notice.text}
        </AdminNotice>
      )}
      <Container className="grid gap-6 pb-section">
        <div className="flex gap-2">
          {views.map((item) => (
            <Link
              key={item.view}
              href={item.href}
              aria-current={item.view === view ? "page" : undefined}
              className="nav-link border border-line aria-[current=page]:border-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {bookings.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong p-8 text-center text-small text-ink-muted">
            No {view} bookings.
          </div>
        ) : (
          <ul className="divide-y rounded-card border border-line">
            {bookings.map((booking) => {
              const actions = adminActionsFor(booking, now);
              return (
                <li key={booking.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:px-6">
                  <div className="grid gap-1 text-small">
                    <span className={cn("text-h4", booking.status === "cancelled" && "text-ink-muted line-through")}>
                      {formatSlot(booking.startsAt, booking.doctor.timeZone)}
                    </span>
                    <span>
                      {booking.doctor.name} · {formatPrice(booking.feeCents, booking.currency)} · Ref {booking.reference}
                    </span>
                    <span className="text-ink-muted">
                      {booking.patientName === null
                        ? "Patient details removed (retention period)"
                        : [booking.patientName, booking.patientEmail, booking.patientPhone].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <BookingStatusBadge status={booking.status} />
                      {booking.cancelledBy && (
                        <span className="text-caption text-ink-muted">
                          {booking.cancelledBy === "system" ? "unpaid, slot released" : `by ${booking.cancelledBy}`}
                        </span>
                      )}
                      <PaymentBadge payment={booking.payment} />
                    </span>
                    {booking.payment && booking.payment.status !== "initialized" && (
                      <span className="text-caption text-ink-muted">Paystack reference {booking.payment.reference}</span>
                    )}
                    <Attendance booking={booking} now={now} />
                  </div>
                  <div className="flex flex-wrap items-start gap-3">
                    {booking.payment?.status === "needs_review" && (
                      <ActionForm
                        action={markRefundedAction}
                        submitLabel="Mark refunded"
                        pendingLabel="Saving…"
                        confirm="Have you refunded this payment in the Paystack dashboard?"
                        variant="outline"
                      >
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="view" value={view} />
                      </ActionForm>
                    )}
                    {actions.cancel && (
                      <ActionForm
                        action={cancelBookingAsHospitalAction}
                        submitLabel="Cancel booking"
                        pendingLabel="Cancelling…"
                        confirm="Cancel and email the patient?"
                        variant="outline"
                      >
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="view" value={view} />
                      </ActionForm>
                    )}
                    {actions.noShow && (
                      <ActionForm action={markNoShowAction} submitLabel="Mark as missed" pendingLabel="Saving…" confirm="The patient didn’t attend?" variant="outline">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="view" value={view} />
                      </ActionForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
