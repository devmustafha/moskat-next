"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export type PayState = { error?: string };

type PayFormProps = {
  /** Server action that restarts checkout for the booking `target` names, then redirects to Paystack. */
  action: (target: string, previous: PayState) => Promise<PayState>;
  target: string;
  label: string;
};

/** "Pay now" for an unpaid booking whose slot is still held. */
export function PayForm({ action, target, label }: PayFormProps) {
  const [state, formAction, pending] = useActionState(action.bind(null, target), {} as PayState);
  return (
    <form action={formAction} className="grid gap-3">
      {state.error && (
        <p role="alert" className="text-small text-alert">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="brand" disabled={pending} className="justify-between sm:w-fit sm:justify-center">
        {pending ? "Starting payment…" : label}
      </Button>
    </form>
  );
}
