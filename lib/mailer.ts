import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Resend client
// ---------------------------------------------------------------------------
// If RESEND_API_KEY is absent (local dev / CI without secrets), we fall back
// to console-logging the email so the rest of the flow works uninterrupted.
// ---------------------------------------------------------------------------

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Autom8x <no-reply@autom8x.ai>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!resend) {
    console.log(
      "[DEV EMAIL — no RESEND_API_KEY set]\n" +
        `  To:      ${to}\n` +
        `  Subject: ${subject}\n` +
        `  Body:    ${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
    );
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    throw new Error(`Resend delivery failure: ${error.message}`);
  }
}

