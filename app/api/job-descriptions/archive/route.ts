import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";
import { isProjectMember } from "@/lib/project-rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Archive (or reopen) a job posting and cascade the flag to its candidates in
// resume_review, matched by job_posting_id. Member-gated; admin client write
// (RLS blocks browser writes). archived_at is stamped on archive, cleared on
// reopen — keeping job_postings and its candidates in sync both directions.
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { postingId?: string; archived?: boolean };
  try {
    body = (await req.json()) as { postingId?: string; archived?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const postingId = String(body.postingId ?? "");
  const archived = Boolean(body.archived);
  if (!postingId) {
    return NextResponse.json({ error: "Missing postingId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm the posting exists and resolve its project for the membership gate.
  const { data: posting, error: lookupErr } = await admin
    .from("job_postings")
    .select("id, project_id")
    .eq("id", postingId)
    .maybeSingle();
  if (lookupErr || !posting?.project_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await isProjectMember(session.user.id, posting.project_id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stamp = archived ? new Date().toISOString() : null;

  // 1) The posting itself.
  const { error: postErr } = await admin
    .from("job_postings")
    .update({ archived, archived_at: stamp })
    .eq("id", postingId);
  if (postErr) {
    console.error("POSTING_ARCHIVE_FAIL", postErr.message);
    return NextResponse.json(
      { error: "Could not update the posting" },
      { status: 502 },
    );
  }

  // 2) Cascade to its candidates (no-op if none are linked yet).
  const { error: candErr } = await admin
    .from("resume_review")
    .update({ archived, archived_at: stamp })
    .eq("job_posting_id", postingId);
  if (candErr) {
    console.error("POSTING_ARCHIVE_CASCADE_FAIL", candErr.message);
    return NextResponse.json(
      { error: "Posting updated but its candidates could not be updated" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, archived });
}
