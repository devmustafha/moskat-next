"use client";

import dynamic from "next/dynamic";
import type { CallClientProps } from "./call-client";

/**
 * The Agora Web SDK only runs in the browser, so the call screen is loaded client-side only.
 * (In the App Router, `ssr: false` is only allowed from a client component like this one.)
 * This also keeps the SDK out of every other page's JavaScript.
 */
const CallClient = dynamic(() => import("./call-client"), {
  ssr: false,
  loading: () => (
    <p role="status" className="rounded-card bg-surface p-8 text-center text-small text-ink-muted">
      Loading the video call…
    </p>
  ),
});

export function ConsultationRoom(props: CallClientProps) {
  return <CallClient {...props} />;
}
