import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { getAppSession } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Bucket routing is keyed off the GCS object-key prefix, NOT the project ID.
// The upload route writes Claros files under these two prefixes; everything
// else (manual uploads from personal/team projects) lives under the user-slug
// prefix in the Autom8x bucket. Keeping the routing data-driven means this
// route needs no awareness of which projects are Claros vs. general.
const CLAROS_PATH_PREFIXES = ["manual_uploads/", "new_invoices/"];

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

function bucketForObjectKey(objectKey: string): string {
  const isClarosPath = CLAROS_PATH_PREFIXES.some((p) => objectKey.startsWith(p));
  const bucketName = isClarosPath
    ? process.env.GCS_INVOICE_BUCKET
    : process.env.AUTOM8X_GCS_BUCKET;
  if (!bucketName) {
    throw new Error(
      `Missing GCS bucket env for ${isClarosPath ? "Claros" : "Autom8x"} path`,
    );
  }
  return bucketName;
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filename = url.searchParams.get("file");
  const loungeCode = url.searchParams.get("lounge");
  const projectId = url.searchParams.get("project");
  if (!filename || !loungeCode || !projectId) {
    return NextResponse.json(
      { error: "Missing project, file, or lounge parameter" },
      { status: 400 },
    );
  }

  // Verify a line-item row exists for this (project_id, filename, lounge_code)
  // tuple before signing. RLS on gl_code_line_items gates on project_memberships,
  // so a user who isn't a member of project_id gets zero rows and a 404 here —
  // they cannot mint URLs for another client's invoice files.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gl_code_line_items")
    .select("id")
    .eq("project_id", projectId)
    .eq("filename", filename)
    .eq("lounge_code", loungeCode)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The DB stores filenames URL-encoded (e.g. "new_invoices%2F2026%2F04%2F...").
  // GCS object names use real slashes, so decode once before signing.
  const objectKey = decodeURIComponent(filename);
  const bucketName = bucketForObjectKey(objectKey);

  try {
    const [signedUrl] = await getStorage()
      .bucket(bucketName)
      .file(objectKey)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 5 * 60 * 1000,
      });
    return NextResponse.redirect(signedUrl, 307);
  } catch (err) {
    console.error("INVOICE_FILE_SIGN_FAIL", (err as Error).message);
    return NextResponse.json(
      { error: "Could not sign URL" },
      { status: 500 },
    );
  }
}
