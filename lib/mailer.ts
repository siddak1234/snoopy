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

// ---------------------------------------------------------------------------
// Domain verification email
// ---------------------------------------------------------------------------

export function buildDomainVerificationEmail(
  orgName: string,
  domain: string,
  verifyUrl: string
): { subject: string; html: string } {
  const subject = `Verify your domain for ${orgName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f0f10;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #e5e5e7;
    }
    .wrapper {
      max-width: 520px;
      margin: 48px auto;
      padding: 0 24px;
    }
    .card {
      background-color: #1a1a1e;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 40px 36px;
    }
    .logo {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #e5e5e7;
      margin-bottom: 28px;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: #f5f5f7;
      margin: 0 0 12px;
      line-height: 1.3;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #a1a1aa;
      margin: 0 0 16px;
    }
    .domain {
      font-family: "SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background-color: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 2px 7px;
      font-size: 13px;
      color: #e5e5e7;
    }
    .cta-wrap {
      margin: 28px 0 24px;
      text-align: center;
    }
    .cta {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 100px;
      padding: 13px 32px;
      letter-spacing: 0.1px;
    }
    .expiry {
      font-size: 13px;
      color: #71717a;
      text-align: center;
      margin: 0 0 28px;
    }
    .divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.07);
      margin: 24px 0;
    }
    .footer {
      font-size: 12px;
      color: #52525b;
      text-align: center;
      line-height: 1.6;
    }
    .fallback-url {
      word-break: break-all;
      font-size: 12px;
      color: #6366f1;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">Autom8x</div>

      <h1>Verify your domain</h1>

      <p>
        You created the organization <strong style="color:#f5f5f7">${orgName}</strong>.
        Click below to verify that you own
        <span class="domain">${domain}</span>
        and enable automatic team joining — anyone with a
        <span class="domain">@${domain}</span> email will be
        able to join your workspace when they sign up.
      </p>

      <div class="cta-wrap">
        <a href="${verifyUrl}" class="cta">Verify domain</a>
      </div>

      <p class="expiry">This link expires in 72 hours.</p>

      <hr class="divider" />

      <p class="footer">
        If the button above does not work, paste this URL into your browser:<br />
        <span class="fallback-url">${verifyUrl}</span>
      </p>

      <p class="footer" style="margin-top:16px">
        If you did not create an Autom8x organization, you can ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
