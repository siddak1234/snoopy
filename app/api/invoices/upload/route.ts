import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";
import { CLAROS_PROJECT_IDS } from "@/lib/claros";

// Manual-upload entry point for the Upload Invoice dialog. Takes a multipart
// form (file + invoice fields), routes to one of two GCS bucket / n8n webhook
// pairs based on whether the projectId is a Claros enterprise project, uploads
// the PDF, then POSTs the schema the matching n8n workflow expects.
//
// Routing summary:
//   Claros team project  →  GCS_INVOICE_BUCKET   + N8N_INGEST_WEBHOOK_URL
//   any other project    →  AUTOM8X_GCS_BUCKET   + AUTOM8X_N8N_WEBHOOK_URL
// Even a Claros employee's personal project routes through the Autom8x flow —
// the boundary is the project, not the person.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Keep in lockstep with MAX_FILE_MB in UploadInvoiceDialog.tsx. 4 MB leaves
// headroom under Vercel's ~4.5 MB serverless body limit for multipart overhead.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_DESCRIPTION_LEN = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Storage client is shared across both buckets — the service account has
// object-level access to whichever bucket we name. Lazily initialised so
// `next build`'s page-data collection (without GCP env vars) doesn't crash.
let cachedStorage: Storage | null = null;
function getStorage(): Storage {
  if (cachedStorage) return cachedStorage;
  const keyB64 = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyB64) {
    throw new Error("Missing GCS env: GCP_SERVICE_ACCOUNT_KEY_BASE64");
  }
  const credentials = JSON.parse(
    Buffer.from(keyB64, "base64").toString("utf-8"),
  );
  cachedStorage = new Storage({
    credentials,
    projectId: credentials.project_id,
  });
  return cachedStorage;
}

type IngestConfig = {
  bucketName: string;
  webhookUrl: string;
  webhookSecret: string;
  // Path prefix under the bucket: Claros keeps the legacy `manual_uploads/...`
  // layout (matches what the existing Claros workflow already filters on);
  // Autom8x uploads sit under `<userSlug>/...` so each user's invoices stay
  // grouped in the new shared bucket.
  pathPrefix: string;
};

function resolveIngestConfig(
  projectId: string,
  userSlug: string,
):
  | { ok: true; config: IngestConfig }
  | { ok: false; status: number; error: string } {
  const isClaros = CLAROS_PROJECT_IDS.has(projectId);
  if (isClaros) {
    const bucketName = process.env.GCS_INVOICE_BUCKET;
    const webhookUrl = process.env.N8N_INGEST_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_INGEST_WEBHOOK_SECRET;
    if (!bucketName || !webhookUrl || !webhookSecret) {
      return {
        ok: false,
        status: 500,
        error: "Server not configured for Claros invoice ingest",
      };
    }
    return {
      ok: true,
      config: { bucketName, webhookUrl, webhookSecret, pathPrefix: "manual_uploads" },
    };
  }
  const bucketName = process.env.AUTOM8X_GCS_BUCKET;
  const webhookUrl = process.env.AUTOM8X_N8N_WEBHOOK_URL;
  const webhookSecret = process.env.AUTOM8X_N8N_WEBHOOK_SECRET;
  if (!bucketName || !webhookUrl || !webhookSecret) {
    return {
      ok: false,
      status: 503,
      error: "Workflow not configured for this project",
    };
  }
  return {
    ok: true,
    config: { bucketName, webhookUrl, webhookSecret, pathPrefix: userSlug },
  };
}

// Build a filesystem-safe folder name from the user's display name, falling
// back to the email's local-part. Whitespace → underscore; strip anything
// outside [A-Za-z0-9_-] so the GCS browser stays readable. Final fallback
// "user" so the path is never empty.
function buildUserSlug(name: string | null | undefined, email: string): string {
  const fromName = (name ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "");
  if (fromName) return fromName;
  const local = (email.split("@")[0] ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_");
  return local || "user";
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  const invoiceNumber = String(form.get("invoiceNumber") ?? "").trim();
  const invoiceDate = String(form.get("invoiceDate") ?? "");
  const merchant = String(form.get("merchant") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }
  if (!invoiceNumber) {
    return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
  }
  if (!ISO_DATE.test(invoiceDate)) {
    return NextResponse.json({ error: "Invoice date is required" }, { status: 400 });
  }
  if (!merchant) {
    return NextResponse.json({ error: "Merchant is required" }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "Location is required" }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    return NextResponse.json(
      { error: `Description must be under ${MAX_DESCRIPTION_LEN} characters` },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be under 4 MB" }, { status: 400 });
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  // Block uploads to projects the user isn't a member of. RLS gates the
  // downstream allocation/line-item tables; this gate stops a stranger from
  // depositing files into a project's GCS prefix.
  const allowed = await isProjectMember(session.user.id, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userSlug = buildUserSlug(session.user.name, session.user.email);
  const resolved = resolveIngestConfig(projectId, userSlug);
  if (!resolved.ok) {
    // Bail before touching GCS — no orphan files when the workflow isn't wired.
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { bucketName, webhookUrl, webhookSecret, pathPrefix } = resolved.config;

  // n8n's schema flows message_id directly into the GCS object path, so it must
  // be unique per upload. internetmessageid mirrors the Outlook Message-ID
  // shape the email pipeline emits so downstream nodes can treat both sources
  // uniformly.
  const uuid = crypto.randomUUID();
  const messageId = uuid.replace(/-/g, "").slice(0, 16);
  const internetMessageId = `<manual-${uuid}@autom8x.app>`;

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const objectName = `${pathPrefix}/${yyyy}/${mm}/${dd}/${messageId}/invoice_0.pdf`;
  const contentType = "application/pdf";

  const buffer = Buffer.from(await file.arrayBuffer());
  const gcsFile = getStorage().bucket(bucketName).file(objectName);
  try {
    await gcsFile.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          uploadedByUserId: session.user.id,
          uploadedByEmail: session.user.email,
          projectId,
          location,
          merchant,
          invoiceNumber,
          invoiceDate,
          originalFilename: file.name,
        },
      },
    });
  } catch (err) {
    console.error("INVOICE_UPLOAD_GCS_FAIL", (err as Error).message);
    return NextResponse.json(
      { error: "Could not upload file to storage" },
      { status: 502 },
    );
  }

  let generation = "";
  let size = buffer.byteLength;
  try {
    const [meta] = await gcsFile.getMetadata();
    if (meta.generation != null) generation = String(meta.generation);
    if (meta.size != null) size = Number(meta.size);
  } catch (err) {
    console.warn("INVOICE_UPLOAD_META_FAIL", (err as Error).message);
  }

  const payload = {
    internetmessageid: internetMessageId,
    message_id: messageId,
    email: session.user.email,
    project_id: projectId,
    description,
    subject: `${location} - ${merchant} - ${invoiceDate} ${invoiceNumber}`,
    bucket: bucketName,
    batch_number: 1,
    batch_count: 1,
    name: objectName,
    content_type: contentType,
    size,
    generation,
  };

  let n8nResp: Response;
  try {
    n8nResp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("INVOICE_UPLOAD_N8N_FAIL", (err as Error).message);
    return NextResponse.json(
      { error: "Could not notify processing workflow" },
      { status: 502 },
    );
  }

  if (!n8nResp.ok) {
    const body = await n8nResp.text().catch(() => "");
    console.error(
      "INVOICE_UPLOAD_N8N_NON_2XX",
      n8nResp.status,
      body.slice(0, 500),
    );
    return NextResponse.json(
      { error: "Processing workflow rejected the upload" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message_id: messageId,
    name: objectName,
  });
}
