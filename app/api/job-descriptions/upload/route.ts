import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStorage, buildJdObjectName, RESUME_BUCKET } from "@/lib/gcs";

// Job-description upload for the New Job Posting dialog. Stores the JD PDF in GCS
// at job_description/{project_id}/{department}/{role}/jd.pdf and upserts the
// job_postings row. Unlike candidate upload, this does NOT trigger any n8n
// workflow — it's just storage + a posting record.

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

  try {
    await getStorage()
      .bucket(RESUME_BUCKET)
      .file(objectName)
      .save(buffer, {
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

  // Upsert the posting (one per project+role+department). Service role — the
  // route already gated on project membership above. RLS still blocks browser
  // writes; reads are RLS-gated for members.
  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("job_postings").upsert(
    {
      project_id: projectId,
      role,
      department,
      jd_object_name: objectName,
      jd_filename: file.name,
      recruiter_email: session.user.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,role,department" },
  );
  if (dbErr) {
    console.error("JD_UPLOAD_DB_FAIL", dbErr.message);
    return NextResponse.json(
      { error: "Saved the file but could not record the posting" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, objectName });
}
