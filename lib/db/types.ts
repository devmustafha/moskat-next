import type { ImageAsset } from "@/lib/images";

/**
 * Shapes the UI works with. Query functions in lib/db/queries.ts map database rows to these,
 * so components don't depend on the table layout.
 */
export type DepartmentIcon = "heart-pulse" | "baby" | "venus" | "bone" | "brain" | "microscope";

export const departmentIcons = ["heart-pulse", "baby", "venus", "bone", "brain", "microscope"] as const satisfies readonly DepartmentIcon[];

export type Service = {
  name: string;
  description: string;
};

export type Department = {
  id: number;
  slug: string;
  name: string;
  icon: DepartmentIcon;
  /** One line, used on cards and in the directory. */
  summary: string;
  /** A short paragraph for the department page. */
  intro: string;
  services: Service[];
  /** Common reasons people are referred. */
  conditions: string[];
  /** Where to find the department in the hospital. */
  location: string;
  onlineConsultations: boolean;
};

export type Doctor = {
  id: number;
  slug: string;
  name: string;
  specialty: string;
  /** Slug of the doctor's department. */
  department: string;
  yearsExperience: number;
  /** Degrees and memberships, most senior first. */
  qualifications: string[];
  languages: string[];
  /** Short biography for the profile page, one paragraph per entry. */
  bio: string[];
  /** Clinical interests, shown as tags on the profile. */
  interests: string[];
  /** Weekdays with video consultation hours, Monday first (derived from availability). */
  videoDays: string[];
  /** Online consultation fee in the currency's minor unit (cents). */
  consultationFeeCents: number;
  currency: string;
  /** Length of a video consultation in minutes. */
  consultationMinutes: number;
  /** IANA time zone the doctor's weekly hours are written in. */
  timeZone: string;
  photo?: ImageAsset;
};

/** Marketing figures derived from the active doctors ("video visits from $40"). */
export type CatalogueStats = {
  lowestFeeCents: number;
  shortestMinutes: number;
  languages: string[];
  doctorCount: number;
};
