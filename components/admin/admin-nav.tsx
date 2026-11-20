import { SectionNav } from "@/components/ui/section-nav";

const links = [
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Doctors", href: "/admin/doctors" },
  { label: "Pricing", href: "/admin/pricing" },
  { label: "Departments", href: "/admin/departments" },
  { label: "Profile", href: "/account" },
] as const;

export type AdminSection = (typeof links)[number]["href"];

/** Tabs between the admin pages (and the admin's account profile). */
export function AdminNav({ current }: { current: AdminSection }) {
  return <SectionNav label="Hospital admin" links={links} current={current} />;
}
