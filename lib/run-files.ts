/**
 * A run's or an item's uploaded file, as the website shows it (Round 19,
 * build 28; the owner's items 4 and 7: "a page to review the original
 * document that you can download and share like other documents"): the rows
 * that open a run's files, named as the app's (`runFileRows`); the pages'
 * paths; the file shown in place only when a browser draws it
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
/**
 * Said where a file could not be read for any other reason: the file
 * route's answer (`lib/file-view.ts`) and a picture's (`Picture.tsx`), the
 * app's `FILE_NOT_OPENED` (`snoopy-mobile/lib/content/screen-states.ts`).
 */
export const COULD_NOT_SHOW = "Could not open the file. Try again.";
/** Said in a picture's place while its file is read: the app's `FILE_OPENING`. */
export const FILE_OPENING = "Opening the file…";
/** The button that reads a file again: the app's `TRY_AGAIN_LABEL`. */
export const TRY_AGAIN = "Try again";

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

/** A file's type by its name's ending, for the share sheet: JSON, a ZIP, a PDF, a workbook, else bytes. */
export function typeOfName(filename: string): string {
  const ending = /\.([a-z0-9]+)$/iu.exec(filename)?.[1]?.toLowerCase();
  switch (ending) {
    case "json":
      return "application/json";
    case "zip":
      return "application/zip";
    case "pdf":
      return "application/pdf";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
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

/** A run's file when its flow names none (the app's `FILE_WORD`). */
export const FILE_WORD = "File";

/**
 * A word inside a sentence — "View resume" — its first letter made small when
 * the next one is small too, so "NDA" stays: `inSentence` in
 * `lib/flow-items.ts`, here too since this module loads on its own.
 */
function inSentence(word: string): string {
  return /^\p{Lu}\p{Ll}/u.test(word)
    ? word.charAt(0).toLocaleLowerCase("en-US") + word.slice(1)
    : word;
}

/** The row that opens a file's page, in the flow's word for it: "View resume". */
export function viewFileLabel(title: string): string {
  return `View ${inSentence(title)}`;
}

/** One "View {file}" row of a run's page: the file it opens, its word and its label. */
export type RunFileRow = { id: string; title: string; label: string };

/**
 * A run's files as its page offers them — the app's `runFileRows`
 * (`snoopy-mobile/lib/view/items.ts`; the owner's build 28 item 7: "the
 * first section should be the view resume button"): one row per file the
 * job uploaded (`RunDetail.files`, in upload order), each named by its
 * flow's file field — the `artifact` fields of its version's `runInput`, in
 * order, the first for any file past them; "File" when the flow names none
 * — "View resume"; files that share a word say which they are, "View photo
 * 1 of 2". The word alone heads the file's page.
 */
export function runFileRows(
  files: readonly { id: string }[] | undefined,
  runInput: readonly { control: string; title: string }[] | undefined,
): RunFileRow[] {
  const fields = (runInput ?? []).filter(
    (field) => field.control === "artifact",
  );
  const titles = (files ?? []).map(
    (_, at) => (fields[at] ?? fields[0])?.title ?? FILE_WORD,
  );
  return (files ?? []).map((file, at) => {
    const title = titles[at] ?? FILE_WORD;
    const same = titles.filter((other) => other === title).length;
    const nth = titles
      .slice(0, at + 1)
      .filter((other) => other === title).length;
    const label = viewFileLabel(title);
    return {
      id: file.id,
      title,
      label: same > 1 ? `${label} ${nth} of ${same}` : label,
    };
  });
}
