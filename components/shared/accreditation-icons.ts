import { Award, BadgeCheck, LockKeyhole, type LucideIcon, ShieldCheck } from "lucide-react";
import type { AccreditationIcon } from "@/lib/data/trust";

/** Lucide icon for each accreditation's `icon` key. */
export const accreditationIcons: Record<AccreditationIcon, LucideIcon> = {
  "shield-check": ShieldCheck,
  award: Award,
  "badge-check": BadgeCheck,
  lock: LockKeyhole,
};
