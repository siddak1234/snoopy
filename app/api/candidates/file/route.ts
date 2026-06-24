import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";
import { getStorage, RESUME_BUCKET } from "@/lib/gcs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves a candidate's resume PDF via a short-lived signed-URL redirect.
// RLS-gated: the select on resume_review returns a row only for project members,
// so a non-member can't mint a URL for another client's resume (0 rows -> 404).
// object_name is stored URL-encoded (%2F for slashes), so decode before signing.
// Mirrors app/api/invoices/file/route.ts and app/api/job-descriptions/file.
export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidateId = new URL(req.url).searchParams.get("candidateId");
  if (!candidateId) {
    return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resume_review")
    .select("object_name")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !data?.object_name) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const objectKey = decodeURIComponent(data.object_name);
  try {
    const [signedUrl] = await getStorage()
      .bucket(RESUME_BUCKET)
      .file(objectKey)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 5 * 60 * 1000,
      });
    return NextResponse.redirect(signedUrl, 307);
  } catch (err) {
    console.error("CANDIDATE_FILE_SIGN_FAIL", (err as Error).message);
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
}
