/**
 * A run's file refused by the platform, said in words (FR-14). A reason this
 * map does not name reads as the platform's own title, as before.
 *
 * Since the platform's BUILD-PLAN 25.2.28 it measures a file when its upload is
 * sealed, for a flow that declares page or pixel limits, and refuses one that
 * breaks them before any run exists: five reasons, two carrying their numbers in
 * `details` as strings of digits. A number that is not one is never shown; the
 * sentence without numbers is said instead.
 *
 * Since BUILD-PLAN 25.2.39 a completion can also find no place yet to measure
 * the file — files are measured in turn, a workspace's one at a time — and is
 * answered 429 `measurement_busy`: not a refusal, and nothing was lost. The Run
 * window completes the same upload again by itself, at most four more times
 * (`upload-completion.ts`); only a file still waiting after the last is said
 * here, and the field is then emptied as after any refusal (`RunFileField.tsx`),
 * so its sentence asks for the file again in a moment.
 */

const UPLOAD_REFUSALS: Record<string, string> = {
  content_type_not_accepted: "This flow does not accept that type of file.",
  file_too_large: "The file is larger than this flow accepts.",
  subscription_not_live: "Turn it on first; a paused flow takes no files.",
  no_file_input: "This flow does not take a file.",
  session_expired: "The upload took too long. Choose the file again.",
  no_object: "The file did not arrive. Choose it again.",
  too_large: "The file is larger than this flow accepts.",
  file_too_many_pages: "This PDF has more pages than this flow reads.",
  file_image_too_large: "This image is larger than this flow takes.",
  file_content_mismatch:
    "This file's contents don't match its type. Choose the original file again.",
  file_encrypted:
    "This PDF is password-protected. Remove the password and upload it again.",
  file_unreadable:
    "This file could not be read. Choose it again, or try another copy.",
  measurement_busy:
    "Files are checked one at a time. Nothing was lost. Choose the file again in a moment.",
};

/** A whole number from the platform's details, or nothing. */
function count(
  details: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key];
  if (typeof value === "string" && /^[0-9]{1,9}$/u.test(value))
    return String(Number(value));
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return String(value);
  return undefined;
}

/** The sentence for a refused upload, or undefined when the reason is not named here. */
export function uploadRefusalMessage(
  reason: unknown,
  details?: Record<string, unknown>,
): string | undefined {
  if (typeof reason !== "string" || !Object.hasOwn(UPLOAD_REFUSALS, reason))
    return undefined;
  if (reason === "file_too_many_pages") {
    const pages = count(details, "pageCount");
    const most = count(details, "maximumPdfPages");
    if (pages && most)
      return `This PDF has ${pages} pages. This flow reads at most ${most}.`;
  }
  if (reason === "file_image_too_large") {
    const width = count(details, "widthPixels");
    const height = count(details, "heightPixels");
    const most = count(details, "maximumImageSidePixels");
    if (width && height && most) {
      return `This image is ${width} × ${height} pixels. This flow takes images up to ${most} pixels on a side.`;
    }
  }
  return UPLOAD_REFUSALS[reason];
}
