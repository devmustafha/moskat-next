import "server-only";

/**
 * Sends email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Needs RESEND_API_KEY, and a sender (siteConfig.email.from) on a domain verified in Resend.
 * Errors carry the HTTP status only: never the response body or the message, which hold patient details.
 */

type Address = { name: string; email: string };

export type EmailMessage = {
  from: Address;
  to: Address;
  subject: string;
  text: string;
  html: string;
};

export type Mailer = { send(message: EmailMessage): Promise<void> };

/** Quotes a display name for an address header, e.g. "Ada Lovelace" <ada@example.com>. */
function mailbox({ name, email }: Address) {
  return `"${name.replace(/["\\\r\n]/g, "")}" <${email}>`;
}

export function createMailer(): Mailer {
  return {
    async send(message) {
      const apiKey = process.env.RESEND_API_KEY;
      // Callers treat a failed send as "the booking stands; show the link instead".
      if (!apiKey) throw new Error("Email not configured (RESEND_API_KEY is not set)");

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: mailbox(message.from),
          to: [mailbox(message.to)],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Resend returned ${response.status}`);
      }
      await response.body?.cancel();
    },
  };
}
