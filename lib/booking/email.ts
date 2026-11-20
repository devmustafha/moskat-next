import type { Mailer } from "@/lib/email/resend";
import { formatPrice, formatSlot } from "@/lib/format";
import { siteConfig } from "@/lib/site";

/**
 * Booking emails, sent through `Mailer` (Resend). They contain the doctor, time and
 * private manage link, and nothing clinical.
 */
type EmailBooking = {
  reference: string;
  startsAt: Date;
  feeCents: number;
  currency: string;
  patientName: string;
  patientEmail: string;
  doctor: { name: string; specialty: string; timeZone: string };
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function layout(heading: string, paragraphs: string[], link?: { href: string; label: string }) {
  const body = paragraphs.map((text) => `<p style="margin:0 0 16px">${text}</p>`).join("");
  const button = link
    ? `<p style="margin:24px 0"><a href="${link.href}" style="background:#0f1419;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:500">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#0f1419;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:22px;font-weight:500">${escapeHtml(heading)}</h1>${body}${button}
<p style="margin:24px 0 0;padding:16px;background:#fef3f2;color:#b42318;border-radius:12px;font-size:14px"><strong>Online consultations are not for emergencies.</strong> If you need urgent help, call ${siteConfig.contact.publicEmergency.label} or our 24-hour emergency line on ${siteConfig.contact.emergencyPhone.label}.</p>
</body></html>`;
}

function details(booking: EmailBooking) {
  const when = formatSlot(booking.startsAt, booking.doctor.timeZone);
  return { when, fee: formatPrice(booking.feeCents, booking.currency) };
}

export async function sendConfirmationEmail(mailer: Mailer, booking: EmailBooking, manageUrl: string) {
  const { when, fee } = details(booking);
  const name = escapeHtml(booking.patientName);
  const doctor = escapeHtml(booking.doctor.name);
  const subject = `Your video consultation with ${booking.doctor.name} is confirmed`;

  await mailer.send({
    from: siteConfig.email.from,
    to: { name: booking.patientName, email: booking.patientEmail },
    subject,
    text: [
      `Hello ${booking.patientName},`,
      "",
      `Your video consultation with ${booking.doctor.name} (${booking.doctor.specialty}) is confirmed for ${when}.`,
      `Reference: ${booking.reference}. Fee: ${fee}; our patient team will send payment details before your appointment.`,
      "",
      `View or cancel your booking: ${manageUrl}`,
      "Keep this link private: anyone with it can see and cancel your booking.",
      "",
      `Online consultations are not for emergencies. If you need urgent help, call ${siteConfig.contact.publicEmergency.label} or ${siteConfig.contact.emergencyPhone.label}.`,
    ].join("\n"),
    html: layout(
      "Your consultation is confirmed",
      [
        `Hello ${name},`,
        `Your video consultation with <strong>${doctor}</strong> (${escapeHtml(booking.doctor.specialty)}) is confirmed for <strong>${escapeHtml(when)}</strong>.`,
        `Reference: <strong>${booking.reference}</strong>. Fee: ${fee}; our patient team will send payment details before your appointment.`,
        "We’ll email the video link before your appointment. Keep the link below private: anyone with it can see and cancel your booking.",
      ],
      { href: manageUrl, label: "View or cancel booking" },
    ),
  });
}

export async function sendCancellationEmail(mailer: Mailer, booking: EmailBooking) {
  const { when } = details(booking);
  await mailer.send({
    from: siteConfig.email.from,
    to: { name: booking.patientName, email: booking.patientEmail },
    subject: `Your consultation on ${when} has been cancelled`,
    text: [
      `Hello ${booking.patientName},`,
      "",
      `Your video consultation with ${booking.doctor.name} on ${when} (reference ${booking.reference}) has been cancelled.`,
      `You can book another time at any point. Questions? Call us on ${siteConfig.contact.phone.label}.`,
    ].join("\n"),
    html: layout("Your consultation has been cancelled", [
      `Hello ${escapeHtml(booking.patientName)},`,
      `Your video consultation with <strong>${escapeHtml(booking.doctor.name)}</strong> on ${escapeHtml(when)} (reference ${booking.reference}) has been cancelled.`,
      `You can book another time at any point. Questions? Call us on ${siteConfig.contact.phone.label}.`,
    ]),
  });
}
