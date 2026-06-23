import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";
import { getStorage, RESUME_BUCKET } from "@/lib/gcs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves the JD PDF for a job posting via a short-lived signed-URL redirect.
// Membership is enforced by RLS: the select on job_postings returns a row only
// for project members, so a non-member can't mint a URL for another client's
// JD (zero rows -> 404 here). Mirrors app/api/invoices/file/route.ts.
export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postingId = new URL(req.url).searchParams.get("postingId");
  if (!postingId) {
    return NextResponse.json({ error: "Missing postingId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_postings")
    .select("jd_object_name")
    .eq("id", postingId)
    .maybeSingle();
  if (error || !data?.jd_object_name) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [signedUrl] = await getStorage()
      .bucket(RESUME_BUCKET)
      .file(data.jd_object_name)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 5 * 60 * 1000,
      });
    return NextResponse.redirect(signedUrl, 307);
  } catch (err) {
    console.error("JD_FILE_SIGN_FAIL", (err as Error).message);
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
}
