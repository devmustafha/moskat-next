import "server-only";
import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import type { PatientSession } from "@/lib/auth/session";
import { cancelAsPatient, type CancelResult, type ManagedBooking, selectManagedBookings } from "@/lib/booking/manage";
import type { Db } from "@/lib/db/client";
import { consultationBookings as bookings } from "@/lib/db/schema";

/**
 * A signed-in patient's own bookings. Every query filters on `patient_user_id = patient.id`,
 * where `patient` is the result of `requirePatient`, never an id taken from the request.
 * Only bookings made while signed in are linked; guest bookings are never matched by email.
 */

/** Most bookings a list shows. Patients rarely have more; older ones stay reachable by link. */
const LIST_LIMIT = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ownedBy(patient: PatientSession) {
  return eq(bookings.patientUserId, patient.id);
}

/** Appointments that haven't ended yet, soonest first, including unpaid and cancelled ones. */
export function listUpcomingBookings(db: Db, patient: PatientSession, now = new Date()): Promise<ManagedBooking[]> {
  return selectManagedBookings(db)
    .where(and(ownedBy(patient), gt(bookings.endsAt, now), inArray(bookings.status, ["pending_payment", "confirmed", "in_progress", "cancelled"])))
    .orderBy(asc(bookings.startsAt))
    .limit(LIST_LIMIT);
}

/**
 * Appointments that have taken place (or were missed), most recent first. Includes confirmed
 * bookings that have ended but haven't been marked completed by the daily job yet.
 */
export function listPastConsultations(db: Db, patient: PatientSession, now = new Date()): Promise<ManagedBooking[]> {
  return selectManagedBookings(db)
    .where(and(ownedBy(patient), lte(bookings.endsAt, now), inArray(bookings.status, ["confirmed", "in_progress", "completed", "no_show"])))
    .orderBy(desc(bookings.startsAt))
    .limit(LIST_LIMIT);
}

/** One of the patient's bookings. Anyone else's booking is null, exactly like one that doesn't exist. */
export async function findPatientBooking(db: Db, patient: PatientSession, id: string): Promise<ManagedBooking | null> {
  if (!UUID.test(id)) return null;
  const [row] = await selectManagedBookings(db)
    .where(and(eq(bookings.id, id), ownedBy(patient)))
    .limit(1);
  return row ?? null;
}

/** Cancel one of the patient's bookings. Ownership is checked again in the UPDATE itself. */
export async function cancelPatientBooking(db: Db, patient: PatientSession, id: string, now = new Date()): Promise<CancelResult> {
  return cancelAsPatient(db, await findPatientBooking(db, patient, id), now, ownedBy(patient));
}
