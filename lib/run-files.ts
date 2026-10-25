/**
 * A run's or an item's uploaded file, as the website shows it (Round 19,
 * build 28; the owner's items 4 and 7: "a page to review the original
 * document that you can download and share like other documents"): its
 * page's paths (the row that opens it is `viewFileLabel`'s, in
 * `lib/flow-items.ts`); the file shown in place only when a browser draws it
 * (a PDF, a JPEG or a PNG), else downloaded to be opened; and its line. The
 * platform answers a short-lived signed link, never the bytes (backend
 * `readRunFile`, `readItemFile`).
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** The most this site reads of one file to show or share it: the platform's package bound. */
export const RUN_FILE_MAXIMUM_BYTES = 25 * 1024 * 1024;

/** Said when the file could not be shared. */
export const SHARE_FAILED = "Could not share. Try again.";
/** Said where a file is not shown in place. */
export const DOWNLOAD_TO_OPEN = "Download it to open it.";
/** Said where the platform no longer keeps the file. */
export const FILE_GONE = "This file is no longer kept.";

/** A run's file page, under the run's. */
export function runFilePath(runId: string, fileId: string): string {
  return `/account/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(fileId)}`;
}

/** An item's file page, under the item's. */
export function itemFilePath(subscriptionId: string, itemId: string): string {
  return `/account/flows/${encodeURIComponent(subscriptionId)}/items/${encodeURIComponent(itemId)}/file`;
}

/** A file page's own route that hands the file on, shown in place. */
export function fileViewHref(pagePath: string): string {
  return `${pagePath}/view`;
}

/** The types a browser draws in place; any other is downloaded to be opened. */
const SHOWN = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** Whether a file of this type is shown in place on its page. */
export function shownInPlace(contentType: string): boolean {
  return SHOWN.has(contentType.toLowerCase());
}

/** A file's size in words: "24 KB", "1.2 MB". */
export function sizeInWords(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A file's line under its name: its format, its pages when measured, its size. */
export function fileLine(file: {
  format: string;
  pages: number | null;
  sizeBytes: number;
}): string {
  const pages =
    file.pages === null
      ? null
      : `${file.pages} ${file.pages === 1 ? "page" : "pages"}`;
  return [file.format, pages, sizeInWords(file.sizeBytes)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The flow's word for a run's file: the title of its version's first file
 * field ("Resume"), else none — and a page then says the file's own name.
 */
export function runFileTitle(
  runInput: readonly { control: string; title: string }[] | undefined,
): string | null {
  return runInput?.find((field) => field.control === "artifact")?.title ?? null;
}
