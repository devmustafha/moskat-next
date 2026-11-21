import { Video } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { consultationWindow } from "@/lib/consultation/access";
import { formatSlot } from "@/lib/format";

type JoinCallCardProps = {
  bookingId: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  now: Date;
};

/**
 * The way into a paid consultation's video call, from the patient's booking page. Shown until the
 * call closes; before it opens, the room still lets them test their camera and microphone.
 */
export function JoinCallCard({ bookingId, startsAt, endsAt, timeZone, now }: JoinCallCardProps) {
  const { opensAt, hardStopAt } = consultationWindow({ startsAt, endsAt });
  if (now >= hardStopAt) return null;
  const open = now >= opensAt;
  const href = `/consultations/${bookingId}`;

  return (
    <Card tone={open ? "default" : "muted"} className="grid gap-4 md:p-8">
      <Video aria-hidden="true" className="size-6 text-brand-700" strokeWidth={1.75} />
      <h2 className="text-h4">{open ? "Your video call is open" : "Video call"}</h2>
      <p className="text-small text-ink-muted">
        {open
          ? "Join from this device. There’s nothing to install."
          : `The call opens on ${formatSlot(opensAt, timeZone)}. You can test your camera and microphone in the video room before then.`}
      </p>
      <ButtonLink href={href} variant={open ? "brand" : "outline"} className="justify-between sm:w-fit">
        {open ? "Join the video call" : "Open the video room"}
      </ButtonLink>
    </Card>
  );
}
