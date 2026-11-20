"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";

export type CancelState = { error?: string };

type CancelFormProps = {
  /** Server action that cancels the booking `target` names (a manage token or a booking id). */
  action: (target: string, previous: CancelState) => Promise<CancelState>;
  target: string;
};

/** Two-step cancel: a first click asks for confirmation, so a stray tap can't cancel. */
export function CancelForm({ action, target }: CancelFormProps) {
  const [state, formAction, pending] = useActionState(action.bind(null, target), {} as CancelState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="outline" withIcon={false} onClick={() => setConfirming(true)}>
        Cancel this booking
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-field bg-surface p-4">
      <p className="text-small font-medium">Cancel this consultation? Your slot will be released to other patients.</p>
      {state.error && (
        <p role="alert" className="text-small text-alert">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" withIcon={false} disabled={pending}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </Button>
        <Button variant="outline" withIcon={false} onClick={() => setConfirming(false)} disabled={pending}>
          Keep my booking
        </Button>
      </div>
    </form>
  );
}
