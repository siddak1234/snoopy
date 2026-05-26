import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Storage, type Bucket } from "@google-cloud/storage";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";

// Manual-upload entry point for the Upload Invoice dialog. Takes a multipart
// form (file + invoice fields), uploads the PDF to GCS at a manual_uploads/
// prefix, then POSTs the schema the n8n ingest workflow expects. Mirrors the
// existing server-side GCS pattern in app/api/invoices/file/route.ts.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Keep in lockstep with MAX_FILE_MB in UploadInvoiceDialog.tsx. 4 MB leaves
// headroom under Vercel's ~4.5 MB serverless body limit for multipart overhead.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Lazy singleton — same shape as file/route.ts. Module-top init would crash
// `next build`'s page-data collection where GCP env vars aren't set.
let cachedBucket: Bucket | null = null;
function getBucket(): Bucket {
  if (cachedBucket) return cachedBucket;
  const keyB64 = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64;
  const bucketName = process.env.GCS_INVOICE_BUCKET;
  if (!keyB64 || !bucketName) {
    throw new Error(
      "Missing GCS env: GCP_SERVICE_ACCOUNT_KEY_BASE64 / GCS_INVOICE_BUCKET",
    );
  }
  const credentials = JSON.parse(
    Buffer.from(keyB64, "base64").toString("utf-8"),
  );
  const storage = new Storage({
    credentials,
    projectId: credentials.project_id,
  });
  cachedBucket = storage.bucket(bucketName);
  return cachedBucket;
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_INGEST_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_INGEST_WEBHOOK_SECRET;
  const bucketName = process.env.GCS_INVOICE_BUCKET;
  if (!webhookUrl || !webhookSecret || !bucketName) {
    return NextResponse.json(
      { error: "Server not configured for invoice ingest" },
      { status: 500 },
    );
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
  const loungeCode = String(form.get("loungeCode") ?? "").trim();

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
  if (!loungeCode) {
    return NextResponse.json({ error: "Lounge code is required" }, { status: 400 });
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
  const objectName = `manual_uploads/${yyyy}/${mm}/${dd}/${messageId}/invoice_0.pdf`;
  const contentType = "application/pdf";

  const buffer = Buffer.from(await file.arrayBuffer());
  const gcsFile = getBucket().file(objectName);
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
          loungeCode,
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
    subject: `${loungeCode} - ${merchant} - ${invoiceDate} ${invoiceNumber}`,
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
