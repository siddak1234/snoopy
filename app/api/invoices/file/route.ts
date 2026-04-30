import { NextResponse } from "next/server";
import { Storage, type Bucket } from "@google-cloud/storage";
import { getAppSession } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lazy singleton. Initialized on first request and reused across warm lambda
// invocations. Module-top init would crash `next build`'s page-data collection,
// where GCP env vars aren't set.
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

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filename = url.searchParams.get("file");
  const loungeCode = url.searchParams.get("lounge");
  if (!filename || !loungeCode) {
    return NextResponse.json(
      { error: "Missing file or lounge parameter" },
      { status: 400 },
    );
  }

  // Verify a line-item row exists for this (filename, lounge_code) pair before
  // signing — prevents users from minting URLs for arbitrary GCS objects.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claros-gl-code")
    .select("id")
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

  try {
    const [signedUrl] = await getBucket().file(objectKey).getSignedUrl({
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
