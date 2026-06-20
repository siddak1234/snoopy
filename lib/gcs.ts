import { Storage } from "@google-cloud/storage";

// Shared Google Cloud Storage helpers. Extracted so the candidate-upload route
// reuses the same client init + slug logic the invoice route established,
// instead of duplicating it. The Storage client is lazily initialised so
// `next build`'s page-data collection (without GCP env) doesn't crash.

// The resumes bucket is a single, fixed destination (not a secret, never
// switched at runtime), so it's a plain constant rather than an env var —
// unlike the invoice buckets, which the invoice route selects between by
// project type. Auth still comes from GCP_SERVICE_ACCOUNT_KEY_BASE64 below.
export const RESUME_BUCKET = "autom8x-resumes";

let cachedStorage: Storage | null = null;

export function getStorage(): Storage {
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

// Build a filesystem-safe folder name from the user's display name, falling
// back to the email's local-part. Whitespace → underscore; strip anything
// outside [A-Za-z0-9_-] so the GCS browser stays readable. Final fallback
// "user" so the path is never empty.
export function buildUserSlug(
  name: string | null | undefined,
  email: string,
): string {
  const fromName = (name ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "");
  if (fromName) return fromName;
  const local = (email.split("@")[0] ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_");
  return local || "user";
}

// Resume object path:
//   resumes/{projectId}/{userSlug}/{yyyy}/{mm}/{dd}/{candidateId}/resume.pdf
// projectId + candidateId are uuids (safe); userSlug is sanitised above; the
// fixed `resume.pdf` leaf avoids the %2F/encoding issues raw filenames cause.
export function buildResumeObjectName(input: {
  projectId: string;
  userSlug: string;
  candidateId: string;
  date: Date;
}): string {
  const { projectId, userSlug, candidateId, date } = input;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `resumes/${projectId}/${userSlug}/${yyyy}/${mm}/${dd}/${candidateId}/resume.pdf`;
}

// Slug for a path segment: spaces → underscore, strip anything outside
// [A-Za-z0-9_-]. Fallback so a segment is never empty.
export function slugify(value: string): string {
  return (
    value.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "") || "untitled"
  );
}

// Job-description object path (same bucket, sibling to resumes/):
//   job_description/{projectId}/{departmentSlug}/{roleSlug}/jd.pdf
// Deterministic from (project, department, role) so candidate screening can
// derive the same path; one JD per opening, so a re-upload overwrites it.
export function buildJdObjectName(input: {
  projectId: string;
  department: string;
  role: string;
}): string {
  return `job_description/${input.projectId}/${slugify(input.department)}/${slugify(input.role)}/jd.pdf`;
}
