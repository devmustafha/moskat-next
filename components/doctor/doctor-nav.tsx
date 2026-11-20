import { SectionNav } from "@/components/ui/section-nav";

const links = [
  { label: "Consultation queue", href: "/doctor/queue" },
  { label: "Schedule", href: "/doctor" },
  { label: "Profile", href: "/account" },
] as const;

export type DoctorSection = (typeof links)[number]["href"];

/** Tabs between a doctor's pages (and their account profile). */
export function DoctorNav({ current }: { current: DoctorSection }) {
  return <SectionNav label="Doctor area" links={links} current={current} />;
}
