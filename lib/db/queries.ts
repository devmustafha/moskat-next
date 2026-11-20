import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { activeWeekdays } from "@/lib/booking/slots";
import { departments, doctorAvailability, doctors } from "@/lib/db/schema";
import type { CatalogueStats, Department, DepartmentIcon, Doctor } from "@/lib/db/types";
import { getDb } from "@/lib/db/server";
import { isoDateIn } from "@/lib/format";

/**
 * Read-only catalogue queries for pages and components. Each is cached for the duration of
 * one request, so a page that shows doctors in several places queries the database once.
 * The catalogue is small (tens of doctors), so lookups by slug filter the cached lists.
 */

export const listDepartments = cache(async (): Promise<Department[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(asc(departments.sortOrder), asc(departments.name));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon as DepartmentIcon,
    summary: row.summary,
    intro: row.intro,
    services: row.services,
    conditions: row.conditions,
    location: row.location,
    onlineConsultations: row.offersVideoVisits,
  }));
});

export const getDepartmentBySlug = cache(async (slug: string) => {
  return (await listDepartments()).find((department) => department.slug === slug) ?? null;
});

export const listDoctors = cache(async (): Promise<Doctor[]> => {
  const db = await getDb();
  const [rows, rules] = await Promise.all([
    db
      .select({ doctor: doctors, departmentSlug: departments.slug })
      .from(doctors)
      .innerJoin(departments, eq(doctors.departmentId, departments.id))
      .where(eq(doctors.isActive, true))
      .orderBy(asc(doctors.sortOrder), asc(doctors.name)),
    db.select().from(doctorAvailability),
  ]);

  return rows.map(({ doctor, departmentSlug }) => ({
    id: doctor.id,
    slug: doctor.slug,
    name: doctor.name,
    specialty: doctor.specialty,
    department: departmentSlug,
    yearsExperience: doctor.yearsExperience,
    qualifications: doctor.qualifications,
    languages: doctor.languages,
    bio: doctor.bio,
    interests: doctor.interests,
    videoDays: activeWeekdays(
      rules.filter((rule) => rule.doctorId === doctor.id),
      isoDateIn(new Date(), doctor.timeZone),
    ),
    consultationFeeCents: doctor.consultationFeeCents,
    currency: doctor.currency,
    consultationMinutes: doctor.consultationMinutes,
    timeZone: doctor.timeZone,
    photo: doctor.photo ?? undefined,
  }));
});

export const getDoctorBySlug = cache(async (slug: string) => {
  return (await listDoctors()).find((doctor) => doctor.slug === slug) ?? null;
});

export const getDoctorsByDepartment = cache(async (departmentSlug: string) => {
  return (await listDoctors()).filter((doctor) => doctor.department === departmentSlug);
});

/** Figures for marketing copy: lowest fee, shortest visit, languages spoken. */
export const getCatalogueStats = cache(async (): Promise<CatalogueStats> => {
  const all = await listDoctors();
  return {
    lowestFeeCents: all.length ? Math.min(...all.map((doctor) => doctor.consultationFeeCents)) : 0,
    shortestMinutes: all.length ? Math.min(...all.map((doctor) => doctor.consultationMinutes)) : 0,
    languages: [...new Set(all.flatMap((doctor) => doctor.languages))].sort(),
    doctorCount: all.length,
  };
});

