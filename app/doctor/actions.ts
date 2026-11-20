"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { type DoctorSession, getDoctorSessionOn } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { type HoursEntry, parseWeeklyHours } from "@/lib/doctor/hours";
import { doctorProfileSchema, doctorRatesSchema } from "@/lib/doctor/profile";
import { getConsultationMinutes, replaceWeeklyHours, updateDoctorProfile, updateDoctorRates } from "@/lib/doctor/queries";
import { formatSlot } from "@/lib/format";

/**
 * Doctor server actions. Each is its own endpoint, so each checks the doctor session itself (on
 * the action's connection) before touching anything. The doctor id always comes from the session,
 * never from the form.
 */

const NOT_DOCTOR: ActionState = { status: "error", message: "Please sign in again with your doctor account." };
const FAILED: ActionState = { status: "error", message: "Something went wrong. Please try again." };

const error = (message: string): ActionState => ({ status: "error", message });
const success = (message: string): ActionState => ({ status: "success", message });

/** Runs `fn` for a signed-in, linked doctor on one connection; logs failures without their details. */
async function asDoctor(name: string, fn: (db: Db, doctor: DoctorSession) => Promise<ActionState>): Promise<ActionState> {
  try {
    return await runWithDb(async (db) => {
      const doctor = await getDoctorSessionOn(db);
      if (!doctor) return NOT_DOCTOR;
      return fn(db, doctor);
    });
  } catch (cause) {
    console.error(`${name} failed: ${safeErrorSummary(cause)}`);
    return FAILED;
  }
}

function refreshDoctorPages() {
  for (const path of ["/doctor", "/doctor/hours", "/doctor/profile"]) revalidatePath(path);
}

const firstIssue = (result: { error: { issues: { message: string }[] } }) => result.error.issues[0]?.message ?? "Please check the form.";

/** Change the doctor's bio, qualifications, languages, interests and years of experience. */
export async function updateDoctorProfileAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = doctorProfileSchema.safeParse({
    bio: formData.get("bio") ?? "",
    qualifications: formData.get("qualifications") ?? "",
    languages: formData.get("languages") ?? "",
    interests: formData.get("interests") ?? "",
    yearsExperience: formData.get("yearsExperience") ?? "",
  });
  if (!parsed.success) return error(firstIssue(parsed));

  return asDoctor("updateDoctorProfile", async (db, doctor) => {
    if (!(await updateDoctorProfile(db, doctor, parsed.data))) return FAILED;
    refreshDoctorPages();
    return success("Saved. Your public profile shows the changes now.");
  });
}

/** Change the doctor's fee and consultation length. Existing bookings keep the fee they were booked at. */
export async function updateDoctorRatesAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = doctorRatesSchema.safeParse({ fee: formData.get("fee") ?? "", minutes: formData.get("minutes") ?? "" });
  if (!parsed.success) return error(firstIssue(parsed));
  const { fee, minutes } = parsed.data;

  return asDoctor("updateDoctorRates", async (db, doctor) => {
    if (!(await updateDoctorRates(db, doctor, { consultationFeeCents: fee, consultationMinutes: minutes }))) return FAILED;
    refreshDoctorPages();
    return success("Saved. New bookings use these settings; existing bookings keep their fee.");
  });
}

/** How many booking references to name in the warning before summarising. */
const LISTED_BOOKINGS = 5;

/** Replace the doctor's weekly hours from today. Existing bookings stay booked. */
export async function updateWeeklyHoursAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const weekdays = formData.getAll("weekday");
  const starts = formData.getAll("start");
  const ends = formData.getAll("end");
  if (weekdays.length !== starts.length || weekdays.length !== ends.length || weekdays.length > 7 * 10) {
    return error("Please check the form.");
  }
  const entries: HoursEntry[] = weekdays.map((weekday, index) => ({ weekday, start: starts[index], end: ends[index] }));

  return asDoctor("updateWeeklyHours", async (db, doctor) => {
    const parsed = parseWeeklyHours(entries, { consultationMinutes: await getConsultationMinutes(db, doctor) });
    if (!parsed.ok) return error(parsed.message);

    const result = await replaceWeeklyHours(db, doctor, parsed.windows);
    if (!result.changed) return success("No changes to save.");
    refreshDoctorPages();
    if (result.outside.length === 0) return success("Saved. Patients can book the new hours now.");

    const listed = result.outside
      .slice(0, LISTED_BOOKINGS)
      .map((booking) => `${booking.reference} (${formatSlot(booking.startsAt, result.timeZone)})`)
      .join(", ");
    const more = result.outside.length > LISTED_BOOKINGS ? ` and ${result.outside.length - LISTED_BOOKINGS} more` : "";
    const count = result.outside.length === 1 ? "1 upcoming booking is" : `${result.outside.length} upcoming bookings are`;
    return {
      status: "success",
      message: `Saved. ${count} outside your new hours and still booked: ${listed}${more}. Contact the hospital if they need to be cancelled.`,
    };
  });
}
