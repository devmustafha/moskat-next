import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/lib/db/auth-schema";
import type { Db } from "@/lib/db/client";
import { getDb, runWithDb } from "@/lib/db/server";
import { type Auth, type AuthConfig, createAuth } from "./auth";
import { findLinkedDoctorId } from "@/lib/doctor/queries";
import { siteOrigin } from "@/lib/origin";
import { isPastAbsoluteLifetime } from "./policy";

/**
 * Sessions on the server. Every protected page and every server action calls one of the
 * `require*` guards itself: layouts don't re-run on client-side navigation, and server actions
 * are separate endpoints, so a check in a layout alone protects nothing.
 */

function authConfig(): AuthConfig {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters (see README: Authentication).");
  return { baseURL: siteOrigin(), secret, pepper: process.env.PASSWORD_PEPPER ?? "" };
}

export function authFor(db: Db): Auth {
  return createAuth(db, authConfig());
}

/** Better Auth for the current render, on the render's shared connection. */
export const getAuth = cache(async () => authFor(await getDb()));

/** Better Auth on a connection of its own, closed when `fn` finishes (route handlers, actions). */
export function runWithAuth<T>(fn: (auth: Auth) => Promise<T>) {
  return runWithDb((db) => fn(authFor(db)));
}

export type SessionUser = { id: string; name: string; email: string; role: Role };

/**
 * The signed-in user for this request, or null when signed out. Expired, revoked and banned
 * sessions are already rejected by Better Auth; sessions past the absolute lifetime are rejected here.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => readSession(await getAuth()));

/** The signed-in user, looked up on `db` (server actions, which run on their own connection). */
export function getSessionOn(db: Db): Promise<SessionUser | null> {
  return readSession(authFor(db));
}

async function readSession(auth: Auth): Promise<SessionUser | null> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result || isPastAbsoluteLifetime(result.session.createdAt, new Date())) return null;
  const { id, name, email, role } = result.user;
  return { id, name, email, role: role as Role };
}

/** The signed-in user, or a redirect to sign-in that comes back to `returnTo` afterwards. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** The signed-in user if they have `role`; otherwise sign-in (signed out) or 403 (wrong role). */
export async function requireRole(role: Role, returnTo: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== role) forbidden();
  return user;
}

export type PatientSession = SessionUser & { role: "patient" };

export function isPatient(user: SessionUser | null): user is PatientSession {
  return user?.role === "patient";
}

/** A signed-in patient. Patient data functions take this, never a user id from the request. */
export async function requirePatient(returnTo: string): Promise<PatientSession> {
  const user = await requireUser(returnTo);
  if (!isPatient(user)) forbidden();
  return user;
}

/** A signed-in doctor and the doctor profile their account is linked to. */
export type DoctorSession = SessionUser & { role: "doctor"; doctorId: number };

/**
 * A signed-in doctor whose account is linked to an active doctor profile. Doctor data functions
 * take this, so they only ever see `doctorId`'s own schedule, bookings and patients.
 * A doctor account with no linked (or an inactive) profile is sent to /doctor/not-linked.
 */
export async function requireDoctor(returnTo: string): Promise<DoctorSession> {
  const user = await requireRole("doctor", returnTo);
  const doctorId = await findLinkedDoctorId(await getDb(), user.id);
  if (doctorId === null) redirect("/doctor/not-linked");
  return { ...user, role: "doctor", doctorId };
}

/**
 * The signed-in doctor and their linked active profile, looked up on `db` (server actions, which
 * run on their own connection), or null for anyone else.
 */
export async function getDoctorSessionOn(db: Db): Promise<DoctorSession | null> {
  const user = await getSessionOn(db);
  if (user?.role !== "doctor") return null;
  const doctorId = await findLinkedDoctorId(db, user.id);
  if (doctorId === null) return null;
  return { ...user, role: "doctor", doctorId };
}

export type AdminSession = SessionUser & { role: "admin" };

export function isAdmin(user: SessionUser | null): user is AdminSession {
  return user?.role === "admin";
}

/**
 * A signed-in hospital administrator. Admin data functions take this. Admins manage doctors,
 * departments, pricing and bookings, but get no access to the doctor or patient areas.
 */
export async function requireAdmin(returnTo: string): Promise<AdminSession> {
  const user = await requireUser(returnTo);
  if (!isAdmin(user)) forbidden();
  return user;
}
