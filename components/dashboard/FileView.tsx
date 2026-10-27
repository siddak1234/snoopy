"use client";

import type { RunFile, RunFileLink } from "@/lib/automations";
import { platformApiJson, siteFileBlob } from "@/lib/platform-api";
import { DOWNLOAD_FAILED } from "@/lib/run-documents";
import { DOWNLOAD_TO_OPEN, fileLine, shownInPlace } from "@/lib/run-files";
import { followSignedLink } from "@/lib/signed-link";
import { SPACING } from "@/lib/spacing";
import { FileActions } from "./FileActions";

/** The word on a file page's Download. */
export const DOWNLOAD = "Download";

/**
 * An uploaded file on its own page (Round 19, build 28; the owner's items 4
 * and 7: "the original document downloadable", "download and share like
 * other documents"): the file itself, in a frame of the page's own route
 * (`viewHref`, `lib/file-view.ts`) when a browser draws it — a PDF, a JPEG
 * or a PNG — else "Download it to open it."; its name and its line (format,
 * pages, size); then Download — the platform's signed link, asked when
 * pressed through `/api/platform` (`linkPath`) and followed only when https
 * (`followSignedLink`), an attachment, so no page is left — and Share, where
 * the browser can hand a file to the share sheet (`navigator.canShare`): the
 * file read from the page's own route (`siteFileBlob`) — both `FileActions`,
 * as every document's are. A refusal is said under the buttons; a share the
 * person closes is no refusal.
 */
export function FileView({
  file,
  viewHref,
  linkPath,
}: {
  file: RunFile;
  /** This site's route that hands the file on (`…/view`). */
  viewHref: string;
  /** The platform's read of its signed link: `/v1/workspaces/…`. */
  linkPath: string;
}) {
  // Download: the platform's signed link, asked when pressed, followed only
  // when https. Share: the bytes from this page's own route.
  const download = async () => {
    try {
      const link = await platformApiJson<RunFileLink>(linkPath);
      return followSignedLink(link.downloadUrl) ? null : DOWNLOAD_FAILED;
    } catch {
      return DOWNLOAD_FAILED;
    }
  };

  return (
    <div className={`flex flex-col ${SPACING.group.gap}`}>
      {shownInPlace(file.contentType) ? (
        <iframe
          title={file.filename}
          src={viewHref}
          data-testid="file-frame"
          className="block h-[calc(100dvh-20rem)] min-h-[24rem] w-full rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]"
        />
      ) : (
        <p className="text-sm text-[var(--muted)]">{DOWNLOAD_TO_OPEN}</p>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium break-words text-[var(--text)]">
          {file.filename}
        </p>
        <p data-testid="file-line" className="text-xs text-[var(--muted)]">
          {fileLine(file)}
        </p>
      </div>
      <FileActions
        downloads={[{ label: DOWNLOAD, run: download }]}
        share={{
          filename: file.filename,
          contentType: file.contentType,
          read: async () => ({ blob: await siteFileBlob(viewHref) }),
        }}
      />
    </div>
  );
}
