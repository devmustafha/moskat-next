import { SectionNav } from "@/components/ui/section-nav";

const links = [
  { label: "Profile", href: "/account" },
  { label: "Upcoming bookings", href: "/account/bookings" },
  { label: "Past consultations", href: "/account/consultations" },
] as const;

export type AccountSection = (typeof links)[number]["href"];

/** Tabs between a patient's account pages. */
export function AccountNav({ current }: { current: AccountSection }) {
  return <SectionNav label="Your account" links={links} current={current} />;
}
