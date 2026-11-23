"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-form";
import {
  cancelBookingAsHospital,
  findLinkedAccount,
  findUnlinkedDoctor,
  linkDoctorAccount,
  markBookingNoShow,
  markPaymentRefunded,
  updateDepartment,
  updateDoctorPricing,
} from "@/lib/admin/queries";
import { type AdminSession, authFor, getSessionOn, isAdmin } from "@/lib/auth/session";
import { sendCancellationEmail } from "@/lib/booking/email";
import { createMailer } from "@/lib/email/resend";
import type { Db } from "@/lib/db/client";
import { safeErrorSummary } from "@/lib/db/errors";
import { runWithDb } from "@/lib/db/server";
import { parseAmountToCents } from "@/lib/money";
import { siteConfig } from "@/lib/site";

/**
 * Admin server actions. Each is its own endpoint, so each checks the admin session itself (on
 * the action's connection) before touching anything; the page's guard doesn't cover it.
 */

const NOT_ADMIN: ActionState = { status: "error", message: "Please sign in again as a hospital administrator." };
const FAILED: ActionState = { status: "error", message: "Something went wrong. Please try again." };

const error = (message: string): ActionState => ({ status: "error", message });
const success = (message: string): ActionState => ({ status: "success", message });

/** An action's result, or a page to go to when the form that submitted it won't be shown any more. */
type Outcome = ActionState | { redirectTo: string };

/**
 * Runs `fn` for a signed-in admin, on one connection; logs failures without their details.
 * Redirects happen here, outside the try, so they aren't caught as errors.
 */
async function asAdmin(name: string, fn: (db: Db, admin: AdminSession) => Promise<Outcome>): Promise<ActionState> {
  let outcome: Outcome;
  try {
    outcome = await runWithDb(async (db) => {
      const user = await getSessionOn(db);
      if (!isAdmin(user)) return NOT_ADMIN;
      return fn(db, user);
    });
  } catch (cause) {
    console.error(`${name} failed: ${safeErrorSummary(cause)}`);
    return FAILED;
  }
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome;
}

/** Better Auth's own error messages (e.g. "User already exists") are safe to show. */
function authErrorMessage(cause: unknown) {
  return cause instanceof APIError ? cause.message : null;
}

const id = z.coerce.number().int().positive();
const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} can be at most ${max} characters.`);

/** The first validation message. Each form is small, so the message alone says which field. */
function firstIssue(result: { error: z.ZodError }) {
  return result.error.issues[0]?.message ?? "Please check the form.";
}

// Doctors ------------------------------------------------------------------------------------

const doctorAccountSchema = z.object({
  doctorId: id,
  name: text("Name", 120),
  email: z.email("Enter a valid email address.").max(254).transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(siteConfig.auth.minPasswordLength, `At least ${siteConfig.auth.minPasswordLength} characters.`)
    .max(siteConfig.auth.maxPasswordLength),
});

/**
 * Create a doctor account and link it to an unlinked profile. If linking fails after the account
 * was created, the account is banned so no unlinked doctor account is left able to sign in.
 */
export async function createDoctorAccountAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = doctorAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error(firstIssue(parsed));
  const input = parsed.data;

  return asAdmin("createDoctorAccount", async (db, admin) => {
    if (!(await findUnlinkedDoctor(db, admin, input.doctorId))) return error("This doctor already has an account.");

    // With the admin's own headers, so Better Auth checks the admin's permissions too.
    const auth = authFor(db);
    const requestHeaders = await headers();
    let userId: string;
    try {
      const { user } = await auth.api.createUser({
        body: { name: input.name, email: input.email, password: input.password, role: "doctor" },
        headers: requestHeaders,
      });
      userId = user.id;
    } catch (cause) {
      const message = authErrorMessage(cause);
      if (message) return error(message);
      throw cause;
    }

    if (!(await linkDoctorAccount(db, admin, input.doctorId, userId))) {
      await auth.api.banUser({ body: { userId, banReason: "Not linked to a doctor profile" }, headers: requestHeaders });
      return error("The account was created but couldn’t be linked, so it has been blocked. Please try again.");
    }

    // The form is replaced by the account details, so the confirmation is shown by the page.
    return { redirectTo: `/admin/doctors?notice=account-created&doctor=${input.doctorId}` };
  });
}

const banSchema = z.object({ doctorId: id, ban: z.enum(["true", "false"]) });

/** Block or unblock a doctor's account. Blocking signs them out everywhere straight away. */
export async function setDoctorAccountBlockedAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = banSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error(firstIssue(parsed));
  const { doctorId, ban } = parsed.data;

  return asAdmin("setDoctorAccountBlocked", async (db, admin) => {
    const userId = await findLinkedAccount(db, admin, doctorId);
    if (!userId) return error("This doctor has no account.");
    const auth = authFor(db);
    try {
      if (ban === "true") {
        await auth.api.banUser({ body: { userId, banReason: "Blocked by a hospital administrator" }, headers: await headers() });
      } else {
        await auth.api.unbanUser({ body: { userId }, headers: await headers() });
      }
    } catch (cause) {
      const message = authErrorMessage(cause);
      if (message) return error(message);
      throw cause;
    }
    revalidatePath("/admin/doctors");
    return success(ban === "true" ? "Account blocked and signed out." : "Account unblocked.");
  });
}

// Pricing ------------------------------------------------------------------------------------

const pricingSchema = z.object({
  doctorId: id,
  fee: z.string().transform((value, ctx) => {
    const cents = parseAmountToCents(value);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 45 or 45.50." });
      return z.NEVER;
    }
    return cents;
  }),
});

/** Change a doctor's fee. Existing bookings keep the fee they were booked at. Every doctor's length is siteConfig's. */
export async function updatePricingAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = pricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error(firstIssue(parsed));
  const { doctorId, fee } = parsed.data;

  return asAdmin("updatePricing", async (db, admin) => {
    if (!(await updateDoctorPricing(db, admin, doctorId, { consultationFeeCents: fee }))) {
      return error("Doctor not found.");
    }
    revalidatePath("/admin/pricing");
    return success("Saved. New bookings use this fee.");
  });
}

// Departments --------------------------------------------------------------------------------

const departmentSchema = z.object({
  departmentId: id,
  name: text("Name", 80),
  summary: text("Summary", 300),
  intro: text("Introduction", 2000),
  location: text("Location", 120),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  isActive: z.literal("on").optional(),
});

export async function updateDepartmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error(firstIssue(parsed));
  const { departmentId, isActive, ...values } = parsed.data;

  return asAdmin("updateDepartment", async (db, admin) => {
    if (!(await updateDepartment(db, admin, departmentId, { ...values, isActive: isActive === "on" }))) {
      return error("Department not found.");
    }
    revalidatePath("/admin/departments");
    return success("Saved.");
  });
}

// Bookings -----------------------------------------------------------------------------------

const bookingSchema = z.object({ bookingId: z.uuid(), view: z.enum(["upcoming", "past"]).catch("upcoming") });

/** Back to the bookings list with a notice; the row's action buttons are gone once its status changes. */
function bookingsNotice(view: "upcoming" | "past", notice: string, reference: string) {
  return { redirectTo: `/admin/bookings?${view === "past" ? "view=past&" : ""}notice=${notice}&ref=${encodeURIComponent(reference)}` };
}

/** Cancel a booking on the hospital's behalf, and tell the patient by email. */
export async function cancelBookingAsHospitalAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error("Booking not found.");

  return asAdmin("cancelBookingAsHospital", async (db, admin) => {
    const result = await cancelBookingAsHospital(db, admin, parsed.data.bookingId);
    if (!result.ok) return error(result.reason === "not_found" ? "Booking not found." : "This booking can no longer be cancelled.");

    const { booking, refundDue } = result;
    let emailed = false;
    if (booking.patientName && booking.patientEmail) {
      try {
        await sendCancellationEmail(
          createMailer(),
          { ...booking, patientName: booking.patientName, patientEmail: booking.patientEmail },
          { refundDue },
        );
        emailed = true;
      } catch (cause) {
        console.error(`Cancellation email failed for booking ${booking.id}: ${safeErrorSummary(cause)}`);
      }
    }
    const notice = refundDue ? (emailed ? "cancelled-refund" : "cancelled-refund-not-emailed") : emailed ? "cancelled" : "cancelled-not-emailed";
    return bookingsNotice(parsed.data.view, notice, booking.reference);
  });
}

/** Record that a payment flagged for review was refunded in the Paystack dashboard. */
export async function markRefundedAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error("Booking not found.");

  return asAdmin("markRefunded", async (db, admin) => {
    const result = await markPaymentRefunded(db, admin, parsed.data.bookingId);
    if (!result.ok) return error("There’s no refund due on this booking.");
    return bookingsNotice(parsed.data.view, "refunded", result.reference);
  });
}

export async function markNoShowAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return error("Booking not found.");

  return asAdmin("markNoShow", async (db, admin) => {
    const result = await markBookingNoShow(db, admin, parsed.data.bookingId);
    if (!result.ok) return error(result.reason === "not_found" ? "Booking not found." : "This booking can’t be marked as missed.");
    return bookingsNotice(parsed.data.view, "no-show", result.booking.reference);
  });
}
