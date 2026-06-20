import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";

// Manual-upload entry point for the Upload Candidate dialog. Takes a multipart
// form (resume PDF + name/role/department), checks project membership, then
// forwards the PDF + metadata to the candidate n8n webhook, which screens the
// resume and inserts the row into resume_review stamped with project_id.
//
// Unlike the invoice route, there is NO GCS step yet — the PDF is forwarded
// straight to n8n as multipart (the webhook node captures it as binary). When a
// resume bucket lands, add the upload-to-GCS step here, mirroring the invoice
// route. Likewise, the user wants this to eventually post directly from the
// frontend; keeping the n8n call isolated here makes that swap a one-file change.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Keep in lockstep with MAX_FILE_MB in UploadCandidateDialog.tsx. 4 MB leaves
// headroom under Vercel's ~4.5 MB serverless body limit for multipart overhead.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Split a single display name into First/Last for resume_review's columns.
// One token → first name only; extra tokens fold into the last name.
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
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be under 4 MB" }, { status: 400 });
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  // Block uploads to projects the user isn't a member of (mirrors the invoice
  // route; the resume_review RLS members-insert policy is the second gate).
  const allowed = await isProjectMember(session.user.id, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookUrl = process.env.CANDIDATE_N8N_WEBHOOK_URL;
  const webhookSecret = process.env.CANDIDATE_N8N_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    return NextResponse.json(
      { error: "Server not configured for candidate ingest" },
      { status: 500 },
    );
  }

  // Pre-generate the resume_review row id so the n8n insert and the UI agree on
  // it (resume_review.id is uuid). The workflow should insert with this id.
  const candidateId = crypto.randomUUID();
  const { first, last } = splitName(name);

  // Forward the resume + metadata as multipart/form-data. Field names map
  // straight onto the resume_review columns the workflow will insert. Note:
  // do NOT set Content-Type — fetch sets the multipart boundary itself.
  const out = new FormData();
  out.append("file", file, file.name);
  out.append("candidate_id", candidateId);
  out.append("project_id", projectId);
  out.append("department", department);
  out.append("job_title", role);
  out.append("name", name);
  out.append("First_Name", first);
  out.append("Last_Name", last);
  out.append("Email_Address", email);
  out.append("filename", file.name);
  out.append("source", "manual_upload");
  out.append("uploaded_by_email", session.user.email);

  let n8nResp: Response;
  try {
    n8nResp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "X-Webhook-Secret": webhookSecret },
      body: out,
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

  return NextResponse.json({ ok: true, candidateId });
}
