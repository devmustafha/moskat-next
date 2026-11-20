import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-nav";
import { BookingList } from "@/components/bookings/booking-list";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { listPastConsultations } from "@/lib/account/queries";
import { requirePatient } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";

export const metadata: Metadata = {
  title: "Past consultations",
  robots: { index: false, follow: false },
};

export default async function PastConsultationsPage() {
  const patient = await requirePatient("/account/consultations");
  const consultations = await listPastConsultations(await getDb(), patient);

  return (
    <>
      <PageHeader title="Past consultations" description="Video consultations you’ve had, most recent first." />
      <AccountNav current="/account/consultations" />
      <Container className="pb-section">
        <BookingList
          bookings={consultations}
          hrefFor={(booking) => `/account/bookings/${booking.id}`}
          empty="You haven’t had a video consultation booked from this account yet."
        />
      </Container>
    </>
  );
}
