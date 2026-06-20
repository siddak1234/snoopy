import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";
import {
  getStorage,
  buildUserSlug,
  buildResumeObjectName,
  RESUME_BUCKET,
} from "@/lib/gcs";

// Manual-upload entry point for the Upload Candidate dialog. Takes a multipart
// form (resume PDF + name/role/department), validates + checks membership,
// uploads the PDF to GCS, then POSTs only lightweight JSON metadata (the object
// path) to the candidate n8n webhook — which PULLS the resume from GCS, screens
// it, and inserts the row into resume_review. The PDF never travels through the
// webhook, so the webhook stays light regardless of file size.
//
// Mirrors app/api/invoices/upload/route.ts (shared GCS init lives in lib/gcs).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Keep in lockstep with MAX_FILE_MB in UploadCandidateDialog.tsx. 4 MB leaves
// headroom under Vercel's ~4.5 MB serverless body limit for multipart overhead;
// oversized PDFs are rejected here before any GCS write.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Split a single display name into First/Last for resume_review's columns.
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
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
  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  const department = String(form.get("department") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Candidate name is required" }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }
  if (!department) {
    return NextResponse.json({ error: "Department is required" }, { status: 400 });
  }
  // Reject oversized / accidental large PDFs before touching GCS.
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be under 4 MB" }, { status: 400 });
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  // Block uploads to projects the user isn't a member of (the resume_review RLS
  // members-insert policy is the second gate, on the n8n insert side).
  const allowed = await isProjectMember(session.user.id, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fixed resumes bucket (constant, not env) + the webhook URL/secret, which ARE
  // env vars (a URL and a secret — real config/credentials, unlike a bucket name).
  const bucketName = RESUME_BUCKET;
  const webhookUrl = process.env.N8N_CANDIDATE_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_CANDIDATE_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    // Bail before touching GCS so we never orphan a file when the pipeline
    // isn't fully configured.
    return NextResponse.json(
      { error: "Server not configured for candidate ingest" },
      { status: 500 },
    );
  }

  // Pre-generate the resume_review row id; it also keys the GCS object path so
  // the file and the (future) row agree on one identifier.
  const candidateId = crypto.randomUUID();
  const userSlug = buildUserSlug(session.user.name, session.user.email);
  const objectName = buildResumeObjectName({
    projectId,
    userSlug,
    candidateId,
    date: new Date(),
  });
  const contentType = "application/pdf";
  const { first, last } = splitName(name);

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
          department,
          jobTitle: role,
          candidateId,
          originalFilename: file.name,
        },
      },
    });
  } catch (err) {
    console.error("CANDIDATE_UPLOAD_GCS_FAIL", (err as Error).message);
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
    console.warn("CANDIDATE_UPLOAD_META_FAIL", (err as Error).message);
  }

  // Light JSON payload — no file bytes. n8n pulls the resume from GCS using
  // bucket + object_name. Field names map onto resume_review columns.
  const payload = {
    candidate_id: candidateId,
    project_id: projectId,
    department,
    job_title: role,
    name,
    First_Name: first,
    Last_Name: last,
    Email_Address: email,
    bucket: bucketName,
    object_name: objectName,
    original_filename: file.name,
    content_type: contentType,
    size,
    generation,
    source: "manual_upload",
    uploaded_by_email: session.user.email,
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
    console.error("CANDIDATE_UPLOAD_N8N_FAIL", (err as Error).message);
    return NextResponse.json(
      { error: "Could not notify processing workflow" },
      { status: 502 },
    );
  }

  if (!n8nResp.ok) {
    const body = await n8nResp.text().catch(() => "");
    console.error(
      "CANDIDATE_UPLOAD_N8N_NON_2XX",
      n8nResp.status,
      body.slice(0, 500),
    );
    return NextResponse.json(
      { error: "Processing workflow rejected the upload" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, candidateId, objectName });
}
