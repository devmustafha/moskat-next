import { Baby, Bone, Brain, HeartPulse, type LucideIcon, Microscope, Venus } from "lucide-react";
import type { DepartmentIcon } from "@/lib/db/types";

/** Lucide icon for each department's `icon` key. */
export const departmentIcons: Record<DepartmentIcon, LucideIcon> = {
  "heart-pulse": HeartPulse,
  baby: Baby,
  venus: Venus,
  bone: Bone,
  brain: Brain,
  microscope: Microscope,
};
