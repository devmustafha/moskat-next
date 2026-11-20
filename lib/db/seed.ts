/**
 * `npm run db:seed`: load the sample catalogue into DATABASE_URL.
 * Safe to re-run: departments and doctors are upserted by slug, and each seeded doctor's weekly
 * hours are replaced. Bookings are never touched.
 */
import { inArray, sql } from "drizzle-orm";
import { withDb } from "@/lib/db/client";
import { departments, doctorAvailability, doctors } from "@/lib/db/schema";
import { seedDepartments, seedDoctors } from "@/lib/db/seed-data";
import { siteConfig } from "@/lib/site";

try {
  process.loadEnvFile();
} catch {}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL before seeding.");

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Sample video clinic hours on each of a doctor's video days.
const SESSIONS = [
  { startTime: "09:00", endTime: "12:00" },
  { startTime: "14:00", endTime: "17:00" },
];

await withDb(url, async (db) => {
  await db.transaction(async (tx) => {
    const departmentRows = await tx
      .insert(departments)
      .values(
        seedDepartments.map((department, index) => ({
          slug: department.slug,
          name: department.name,
          icon: department.icon,
          summary: department.summary,
          intro: department.intro,
          location: department.location,
          services: department.services,
          conditions: department.conditions,
          offersVideoVisits: department.onlineConsultations,
          sortOrder: index,
        })),
      )
      .onConflictDoUpdate({
        target: departments.slug,
        set: {
          name: sql`excluded.name`,
          icon: sql`excluded.icon`,
          summary: sql`excluded.summary`,
          intro: sql`excluded.intro`,
          location: sql`excluded.location`,
          services: sql`excluded.services`,
          conditions: sql`excluded.conditions`,
          offersVideoVisits: sql`excluded.offers_video_visits`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: departments.id, slug: departments.slug });

    const departmentId = new Map(departmentRows.map((row) => [row.slug, row.id]));

    const doctorRows = await tx
      .insert(doctors)
      .values(
        seedDoctors.map((doctor, index) => {
          const id = departmentId.get(doctor.department);
          if (!id) throw new Error(`Unknown department "${doctor.department}" for ${doctor.slug}`);
          return {
            slug: doctor.slug,
            departmentId: id,
            name: doctor.name,
            specialty: doctor.specialty,
            yearsExperience: doctor.yearsExperience,
            qualifications: doctor.qualifications,
            languages: doctor.languages,
            bio: doctor.bio,
            interests: doctor.interests,
            photo: doctor.photo ?? null,
            consultationFeeCents: doctor.consultationFeeCents,
            currency: siteConfig.currency,
            consultationMinutes: doctor.consultationMinutes,
            timeZone: siteConfig.timeZone,
            sortOrder: index,
          };
        }),
      )
      .onConflictDoUpdate({
        target: doctors.slug,
        set: {
          departmentId: sql`excluded.department_id`,
          name: sql`excluded.name`,
          specialty: sql`excluded.specialty`,
          yearsExperience: sql`excluded.years_experience`,
          qualifications: sql`excluded.qualifications`,
          languages: sql`excluded.languages`,
          bio: sql`excluded.bio`,
          interests: sql`excluded.interests`,
          photo: sql`excluded.photo`,
          consultationFeeCents: sql`excluded.consultation_fee_cents`,
          currency: sql`excluded.currency`,
          consultationMinutes: sql`excluded.consultation_minutes`,
          timeZone: sql`excluded.time_zone`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: doctors.id, slug: doctors.slug });

    const doctorId = new Map(doctorRows.map((row) => [row.slug, row.id]));

    await tx.delete(doctorAvailability).where(inArray(doctorAvailability.doctorId, [...doctorId.values()]));
    await tx.insert(doctorAvailability).values(
      seedDoctors.flatMap((doctor) =>
        doctor.videoDays.flatMap((day) =>
          SESSIONS.map((session) => ({
            doctorId: doctorId.get(doctor.slug) as number,
            weekday: WEEKDAYS.indexOf(day) + 1,
            startTime: session.startTime,
            endTime: session.endTime,
            effectiveFrom: "2026-01-01",
          })),
        ),
      ),
    );

    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(doctorAvailability);
    console.log(`Seeded ${departmentRows.length} departments, ${doctorRows.length} doctors, ${count} weekly hour rules.`);
  });
});
