import { SectionNav } from "@/components/ui/section-nav";

const links = [
  { label: "Consultation queue", href: "/doctor/queue" },
  { label: "Schedule", href: "/doctor" },
  { label: "Weekly hours", href: "/doctor/hours" },
  { label: "Profile and rates", href: "/doctor/profile" },
  { label: "Account", href: "/account" },
] as const;

export type DoctorSection = (typeof links)[number]["href"];

/** Tabs between a doctor's pages (and their account). */
export function DoctorNav({ current }: { current: DoctorSection }) {
  return <SectionNav label="Doctor area" links={links} current={current} />;
}
