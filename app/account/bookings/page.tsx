import type { Metadata } from "next";
import Link from "next/link";
import { AccountNav } from "@/components/account/account-nav";
import { BookingList } from "@/components/bookings/booking-list";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { listUpcomingBookings } from "@/lib/account/queries";
import { requirePatient } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Upcoming bookings",
  robots: { index: false, follow: false },
};

export default async function UpcomingBookingsPage() {
  const patient = await requirePatient("/account/bookings");
  const bookings = await listUpcomingBookings(await getDb(), patient);

  return (
    <>
      <PageHeader
        title="Upcoming bookings"
        description="Video consultations you’ve booked while signed in. Bookings made without signing in are managed from the link in their confirmation email."
      />
      <AccountNav current="/account/bookings" />
      <Container className="pb-section">
        <BookingList
          bookings={bookings}
          hrefFor={(booking) => `/account/bookings/${booking.id}`}
          empty={
            <>
              You have no upcoming bookings.{" "}
              <Link href={siteConfig.bookingHref} className="link text-ink">
                Book a video consultation
              </Link>
              .
            </>
          }
        />
      </Container>
    </>
  );
}
