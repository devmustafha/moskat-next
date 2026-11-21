import { CheckCircle2, CircleAlert, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CancelForm } from "@/components/bookings/cancel-form";
import { PayForm } from "@/components/bookings/pay-form";
import { JoinCallCard } from "@/components/consultation/join-call-card";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { findPatientBooking } from "@/lib/account/queries";
import { requirePatient } from "@/lib/auth/session";
import { canPatientCancel } from "@/lib/booking/manage";
import { isLiveHold } from "@/lib/booking/status";
import { getDb } from "@/lib/db/server";
import { formatPrice, formatSlot, formatTime } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { cancelOwnBookingAction, payBookingAction } from "./actions";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string; payment?: string }>;
};

function Notice({ tone, children }: { tone: "success" | "info" | "alert"; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Clock : CircleAlert;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-field p-4 text-small",
        tone === "success" && "bg-brand-50 text-brand-800",
        tone === "info" && "bg-surface",
        tone === "alert" && "bg-alert-soft text-alert",
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone === "info" && "text-brand-700")} strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}

/** One of the patient's bookings. Anyone else's booking is a 404, the same as one that doesn't exist. */
export default async function AccountBookingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const patient = await requirePatient(`/account/bookings/${encodeURIComponent(id)}`);
  const booking = await findPatientBooking(await getDb(), patient, id);
  if (!booking) notFound();

  const flags = await searchParams;
  const now = new Date();
  const cancellable = canPatientCancel(booking, now);
  const { phone } = siteConfig.contact;
  const past = booking.endsAt.getTime() <= now.getTime();
  const fee = formatPrice(booking.feeCents, booking.currency);
  const unpaid = booking.status === "pending_payment";
  const holdLive = unpaid && isLiveHold(booking, now);
  const { refundBusinessDays } = siteConfig.booking;

  return (
    <>
      <PageHeader
        eyebrow={`Booking ${booking.reference}`}
        breadcrumbs={[
          { label: "Your account", href: "/account" },
          past ? { label: "Past consultations", href: "/account/consultations" } : { label: "Upcoming bookings", href: "/account/bookings" },
        ]}
        title={
          <>
            Video consultation <span className="text-ink-subtle">with {booking.doctor.name}.</span>
          </>
        }
      />
      <Container className="grid gap-10 pb-section lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:gap-16">
        <div className="grid content-start gap-6">
          {booking.status === "confirmed" && flags.payment === "success" && (
            <Notice tone="success">
              <strong className="font-semibold">Payment received. You’re booked.</strong> We’ve emailed a confirmation to{" "}
              {booking.patientEmail}; Paystack sends your receipt separately.
            </Notice>
          )}
          {unpaid && holdLive && flags.payment === "pending" && (
            <Notice tone="info">
              We’re confirming your payment with Paystack. This usually takes a few seconds:{" "}
              <Link href={`/account/bookings/${booking.id}`} className="link">
                refresh this page
              </Link>
              . If you closed the payment page without paying, you can pay below.
            </Notice>
          )}
          {unpaid && flags.payment === "failed" && (
            <Notice tone="alert">Your payment didn’t go through, and you haven’t been charged. You can try again below.</Notice>
          )}
          {flags.payment === "review" && (
            <Notice tone="alert">
              We received your payment, but this time was no longer held for you. We’ll refund {fee} to the card or account
              you paid with, usually within {refundBusinessDays} business days. Questions? Call us on{" "}
              <a href={phone.href} className="link">
                {phone.label}
              </a>
              .
            </Notice>
          )}
          {booking.status === "cancelled" && flags.cancelled === "refund" && (
            <Notice tone="info">
              We’ve cancelled your consultation and emailed you a confirmation. We’ll refund {fee} to the card or account you
              paid with, usually within {refundBusinessDays} business days.
            </Notice>
          )}
          {booking.status === "cancelled" && flags.cancelled === "1" && (
            <Notice tone="info">
              We’ve cancelled your consultation{booking.paid ? "." : ". You haven’t been charged."}
            </Notice>
          )}

          {booking.paid && (booking.status === "confirmed" || booking.status === "in_progress") && (
            <JoinCallCard bookingId={booking.id} startsAt={booking.startsAt} endsAt={booking.endsAt} timeZone={booking.doctor.timeZone} now={now} />
          )}

          {holdLive && booking.paymentExpiresAt && (
            <Card tone="muted" className="grid gap-4 md:p-8">
              <h2 className="text-h4">Complete your payment to confirm this booking</h2>
              <p className="text-small text-ink-muted">
                We’re holding this time for you until {formatTime(booking.paymentExpiresAt, booking.doctor.timeZone)}. After
                that it’s released to other patients.
              </p>
              <PayForm action={payBookingAction} target={booking.id} label={`Pay ${fee}`} />
            </Card>
          )}
          {unpaid && !holdLive && (
            <Notice tone="alert">
              This time was released because payment wasn’t completed, and you haven’t been charged.{" "}
              <Link href={`/doctors/${booking.doctor.slug}/book`} className="link">
                Choose another time
              </Link>
              .
            </Notice>
          )}

          <Card className="md:p-8">
            <dl className="grid gap-5 text-small sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-ink-muted">When</dt>
                <dd className={cn("mt-1 text-h4", booking.status === "cancelled" && "text-ink-muted line-through")}>
                  {formatSlot(booking.startsAt, booking.doctor.timeZone)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Doctor</dt>
                <dd className="mt-1">
                  <Link href={`/doctors/${booking.doctor.slug}`} className="link font-medium">
                    {booking.doctor.name}
                  </Link>
                  <span className="block text-ink-muted">{booking.doctor.specialty}</span>
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Status</dt>
                <dd className="mt-1">
                  <BookingStatusBadge status={booking.status} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Fee</dt>
                <dd className="mt-1">
                  {fee}
                  {booking.paid ? ", paid" : unpaid ? ", not paid yet" : ""}
                </dd>
              </div>
              {booking.patientName && (
                <div>
                  <dt className="text-ink-muted">Patient</dt>
                  <dd className="mt-1">{booking.patientName}</dd>
                </div>
              )}
            </dl>

            {cancellable && (
              <div className="mt-8 border-t pt-6">
                <CancelForm action={cancelOwnBookingAction} target={booking.id} />
                <p className="mt-3 text-caption text-ink-muted">
                  You can cancel online until {siteConfig.booking.cancelUntilHours} hours before the start time
                  {booking.paid ? `, and we’ll refund your payment in full.` : "."}
                </p>
              </div>
            )}
            {booking.status === "confirmed" && !cancellable && !past && (
              <p className="mt-8 border-t pt-6 text-small text-ink-muted">
                It’s too late to cancel online. To change this appointment, call us on{" "}
                <a href={phone.href} className="link text-ink">
                  {phone.label}
                </a>
                .
              </p>
            )}
          </Card>
        </div>
        <div className="grid content-start gap-5">
          {booking.status === "confirmed" && !past && (
            <Card tone="muted" className="md:p-8">
              <h2 className="text-h4">What happens next</h2>
              <ol className="mt-4 grid gap-3 text-small text-ink-muted">
                <li>1. Your booking is confirmed and paid. You’ll find it under Upcoming bookings.</li>
                <li>2. From 10 minutes before the start, join the video call from this page. There’s no app to install.</li>
                <li>3. Join a few minutes early from a quiet, private space.</li>
              </ol>
            </Card>
          )}
          {booking.status === "cancelled" && (
            <ButtonLink href={`/doctors/${booking.doctor.slug}/book`} className="justify-between sm:w-fit">
              Book another time
            </ButtonLink>
          )}
          <EmergencyNotice variant="inline" />
        </div>
      </Container>
    </>
  );
}
