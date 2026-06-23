import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStorage, buildJdObjectName, RESUME_BUCKET } from "@/lib/gcs";

// Job-description upload for the New Job Posting dialog. Stores the JD PDF in GCS
// at job_description/{project_id}/{department}/{role}/jd.pdf, upserts the
// job_postings row (marking it parse_status='pending'), then POSTs lightweight
// JSON metadata to the JD n8n webhook — which PULLS the JD from GCS, parses it
// with an LLM, and writes the parsed columns back to the same job_postings row.
// Mirrors the candidate upload webhook pattern (shared GCS init in lib/gcs).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

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
  const role = String(form.get("role") ?? "").trim();
  const department = String(form.get("department") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
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

  const allowed = await isProjectMember(session.user.id, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const objectName = buildJdObjectName({ projectId, department, role });
  const contentType = "application/pdf";
  const buffer = Buffer.from(await file.arrayBuffer());

  const gcsFile = getStorage().bucket(RESUME_BUCKET).file(objectName);
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
          role,
          kind: "job_description",
          originalFilename: file.name,
        },
      },
    });
  } catch (err) {
    console.error("JD_UPLOAD_GCS_FAIL", (err as Error).message);
    return NextResponse.json(
      { error: "Could not upload file to storage" },
      { status: 502 },
    );
  }

  // Best-effort object metadata for the webhook payload (parity with candidate
  // upload). A miss just leaves size as the local byte length and generation "".
  let generation = "";
  let size = buffer.byteLength;
  try {
    const [meta] = await gcsFile.getMetadata();
    if (meta.generation != null) generation = String(meta.generation);
    if (meta.size != null) size = Number(meta.size);
  } catch (err) {
    console.warn("JD_UPLOAD_META_FAIL", (err as Error).message);
  }

  // Upsert the posting (one per project+role+department). Service role — the
  // route already gated on project membership above. RLS still blocks browser
  // writes; reads are RLS-gated for members.
  const admin = createAdminClient();
  const { data: postingRow, error: dbErr } = await admin
    .from("job_postings")
    .upsert(
      {
        project_id: projectId,
        role,
        department,
        jd_object_name: objectName,
        jd_filename: file.name,
        recruiter_email: session.user.email,
        // A fresh upload (or re-upload) re-queues parsing; n8n flips this to
        // 'parsed' and bumps version once it has parsed the JD.
        parse_status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,role,department" },
    )
    .select("id")
    .single();
  if (dbErr || !postingRow) {
    console.error("JD_UPLOAD_DB_FAIL", dbErr?.message);
    return NextResponse.json(
      { error: "Saved the file but could not record the posting" },
      { status: 502 },
    );
  }
  const jobPostingId = postingRow.id as string;

  // Best-effort: notify the JD parsing workflow. The posting + file are already
  // persisted, so a webhook problem must NOT fail the request — the row stays
  // parse_status='pending' and a later edit (or retry) re-fires. n8n PULLS the
  // JD from GCS via bucket + jd_object_name and writes the parsed columns back
  // to this row by job_posting_id. role/department also feed the parser hints.
  const webhookUrl = process.env.N8N_JD_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_JD_WEBHOOK_SECRET;
  if (webhookUrl && webhookSecret) {
    const payload = {
      job_posting_id: jobPostingId,
      project_id: projectId,
      role,
      department,
      bucket: RESUME_BUCKET,
      jd_object_name: objectName,
      jd_filename: file.name,
      content_type: contentType,
      size,
      generation,
      recruiter_email: session.user.email,
      source: "job_posting",
    };
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": webhookSecret,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("JD_UPLOAD_N8N_NON_2XX", resp.status, body.slice(0, 500));
      }
    } catch (err) {
      console.error("JD_UPLOAD_N8N_FAIL", (err as Error).message);
    }
  } else {
    console.warn("JD_UPLOAD_N8N_SKIP: webhook env not configured");
  }

  return NextResponse.json({ ok: true, objectName, jobPostingId });
}
