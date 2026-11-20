"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { siteConfig } from "@/lib/site";

const { minPasswordLength, maxPasswordLength } = siteConfig.auth;

type AuthError = { status?: number; code?: string; message?: string } | null;

/** Messages people can act on. Never says whether an email has an account when signing in. */
function describeError(error: AuthError, action: "sign-in" | "sign-up" | "change-password") {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (error.code === "BANNED_USER") return "This account can’t sign in. Please contact the hospital.";
  if (action === "sign-in") return "Email or password is incorrect.";
  if (action === "sign-up" && error.code?.includes("ALREADY_EXISTS")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (action === "change-password" && error.code === "INVALID_PASSWORD") return "Your current password is incorrect.";
  if (error.code === "PASSWORD_TOO_SHORT") return `Use at least ${minPasswordLength} characters.`;
  if (error.code === "PASSWORD_TOO_LONG") return `Use at most ${maxPasswordLength} characters.`;
  if (error.code?.includes("EMAIL")) return "Please enter a valid email address.";
  return "Something went wrong. Please try again.";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-caption font-medium">
      {label}
      {children}
      {hint && <span className="font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-field bg-alert/10 px-4 py-3 text-small text-alert">
      {message}
    </p>
  );
}

/**
 * False until React has hydrated the form. Before that, submitting would be a native form submit
 * that skips `onSubmit`, so the submit buttons stay disabled (which also blocks Enter-to-submit),
 * and the forms use method="post" so a password can never end up in a URL.
 */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/** Full page load after signing in or out, so every server component sees the new session. */
function go(href: string) {
  window.location.assign(href);
}

export function SignInForm({ next }: { next: string }) {
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      rememberMe: true,
    });
    if (error) {
      setError(describeError(error, "sign-in"));
      setPending(false);
      return;
    }
    go(next);
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-5">
      <FormError message={error} />
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required maxLength={254} className="field" />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required maxLength={maxPasswordLength} className="field" />
      </Field>
      <Button type="submit" disabled={pending || !hydrated} className="justify-between">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setError(describeError(error, "sign-up"));
      setPending(false);
      return;
    }
    go(next);
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-5">
      <FormError message={error} />
      <Field label="Full name">
        <input name="name" autoComplete="name" required maxLength={120} className="field" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required maxLength={254} className="field" />
      </Field>
      <Field label="Password" hint={`At least ${minPasswordLength} characters. A short phrase is easier to remember.`}>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          maxLength={maxPasswordLength}
          className="field"
        />
      </Field>
      <p className="text-caption text-ink-muted">
        By creating an account you agree to how we handle your details, described in our{" "}
        <Link href="/privacy" className="link">
          privacy notice
        </Link>
        .
      </p>
      <Button type="submit" disabled={pending || !hydrated} className="justify-between">
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const hydrated = useHydrated();
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmPassword")) {
      setMessage({ kind: "error", text: "The new passwords don’t match." });
      return;
    }
    setPending(true);
    setMessage(null);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword,
      // Signs out every other device, e.g. if someone else knew the old password.
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) {
      setMessage({ kind: "error", text: describeError(error, "change-password") });
      return;
    }
    formElement.reset();
    setMessage({ kind: "success", text: "Password changed. You’ve been signed out on your other devices." });
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-5">
      {message?.kind === "error" && <FormError message={message.text} />}
      {message?.kind === "success" && (
        <p role="status" className="rounded-field bg-brand-50 px-4 py-3 text-small text-brand-700">
          {message.text}
        </p>
      )}
      <Field label="Current password">
        <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={maxPasswordLength} className="field" />
      </Field>
      <Field label="New password" hint={`At least ${minPasswordLength} characters.`}>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          maxLength={maxPasswordLength}
          className="field"
        />
      </Field>
      <Field label="Repeat new password">
        <input name="confirmPassword" type="password" autoComplete="new-password" required maxLength={maxPasswordLength} className="field" />
      </Field>
      <Button type="submit" variant="outline" withIcon={false} disabled={pending || !hydrated} className="justify-self-start">
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    go("/");
  }

  return (
    <Button variant="outline" withIcon={false} onClick={signOut} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
