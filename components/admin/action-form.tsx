"use client";

import { type ReactNode, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

type ActionFormProps = {
  /** Server action. Reads its inputs from the form, and checks the admin session itself. */
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  /** Inputs (including hidden ids) rendered inside the form. */
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Asks for a second click first, for actions that can't be undone (cancel, no-show, ban). */
  confirm?: string;
  variant?: "primary" | "outline";
  className?: string;
};

const idle: ActionState = { status: "idle" };

/** A form for one admin action, with its own pending state and result message. */
export function ActionForm({ action, children, submitLabel, pendingLabel, confirm, variant = "primary", className }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, idle);
  const [confirming, setConfirming] = useState(false);
  // Disabled until hydrated, so an early click is never a native submit.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => setConfirming(false), [state]);

  const submit = (
    <Button type="submit" variant={variant} size="sm" withIcon={false} disabled={pending || !hydrated}>
      {pending ? (pendingLabel ?? "Saving…") : confirming ? `Yes, ${submitLabel.toLowerCase()}` : submitLabel}
    </Button>
  );

  return (
    <form method="post" action={formAction} className={cn("grid gap-3", className)}>
      {children}
      {confirm && !confirming ? (
        <Button variant={variant} size="sm" withIcon={false} disabled={!hydrated} onClick={() => setConfirming(true)} className="justify-self-start">
          {submitLabel}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {confirming && <span className="text-caption font-medium">{confirm}</span>}
          {submit}
          {confirming && (
            <Button variant="outline" size="sm" withIcon={false} onClick={() => setConfirming(false)} disabled={pending}>
              Keep it
            </Button>
          )}
        </div>
      )}
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={cn("text-caption", state.status === "error" ? "text-alert" : "text-brand-700")}>
          {state.message}
        </p>
      )}
    </form>
  );
}
