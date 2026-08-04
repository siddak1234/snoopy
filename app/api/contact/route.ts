import { NextResponse } from "next/server";

/**
 * Contact-form intake → n8n webhook (same convention as the invoice/JD
 * uploads: POST JSON with X-Webhook-Secret). Follow-up automation — routing,
 * CRM, notifications — lives in n8n, not here.
 *
 * 503 when the webhook env is unset; the client falls back to a mailto link.
 */

type ContactPayload = {
  industry?: string;
  workflow?: string;
  tools?: string;
  volume?: string;
  email?: string;
  success?: string;
  /** Honeypot — humans never fill this. */
  company?: string;
};

const MAX_FIELD_LENGTH = 2000;

/** Coerce an unknown JSON field to a trimmed, clipped string. */
function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_FIELD_LENGTH)
    : "";
}

export async function POST(request: Request) {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // JSON "null", arrays, numbers etc. all parse successfully — reject
  // anything that isn't a plain object before touching fields.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed as ContactPayload;

  // Honeypot: pretend success so bots learn nothing.
  if (asString(body.company)) {
    return NextResponse.json({ ok: true });
  }

  const email = asString(body.email);
  const workflow = asString(body.workflow);
  if (!email || !email.includes("@") || !workflow) {
    return NextResponse.json(
      { error: "Please include your email and the workflow to automate." },
      { status: 400 },
    );
  }

  const clip = (value?: string) => asString(value);

  const webhookUrl = process.env.AUTOM8X_N8N_WEBHOOK_URL;
  const webhookSecret = process.env.AUTOM8X_N8N_WEBHOOK_SECRET;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Contact form is not configured" },
      { status: 503 },
    );
  }

  const payload = {
    source: "contact-form",
    industry: clip(body.industry),
    workflow: clip(workflow),
    tools: clip(body.tools),
    volume: clip(body.volume),
    email: clip(email),
    success: clip(body.success),
    submitted_at: new Date().toISOString(),
  };

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("CONTACT_N8N_FAIL", (err as Error).message);
    return NextResponse.json(
      { error: "Could not deliver your message" },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("CONTACT_N8N_NON_2XX", response.status, text.slice(0, 500));
    return NextResponse.json(
      { error: "Could not deliver your message" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
