"use client";

import { useState, useSyncExternalStore } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { RunFile, RunFileLink } from "@/lib/automations";
import { platformApiJson, siteFileBlob } from "@/lib/platform-api";
import { DOWNLOAD_FAILED } from "@/lib/run-documents";
import {
  DOWNLOAD_TO_OPEN,
  SHARE_FAILED,
  fileLine,
  shownInPlace,
} from "@/lib/run-files";
import { followSignedLink } from "@/lib/signed-link";

const noSubscription = () => () => {};

/** Whether this browser hands a file of this kind to the share sheet. */
function sharesFiles(filename: string, contentType: string): boolean {
  try {
    return (
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File([""], filename, { type: contentType })],
      })
    );
  } catch {
    return false;
  }
}

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
 * file read from the page's own route (`siteFileBlob`). A refusal is said
 * under the buttons; a share the person closes is no refusal.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The share sheet takes files only in some browsers; the server says no.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => sharesFiles(file.filename, file.contentType),
    () => false,
  );

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const link = await platformApiJson<RunFileLink>(linkPath);
      if (!followSignedLink(link.downloadUrl)) setError(DOWNLOAD_FAILED);
    } catch {
      setError(DOWNLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await siteFileBlob(viewHref);
      await navigator.share({
        files: [new File([blob], file.filename, { type: file.contentType })],
        title: file.filename,
      });
    } catch (thrown) {
      // Closing the share sheet is the person's choice, not a failure.
      if (!(thrown instanceof DOMException && thrown.name === "AbortError"))
        setError(SHARE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void download()}
          className="inline-flex items-center gap-2"
        >
          <DownloadSimpleIcon size={20} aria-hidden />
          Download
        </Button>
        {canShare ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void share()}
            className="inline-flex items-center gap-2"
          >
            <ShareNetworkIcon size={20} aria-hidden />
            Share
          </Button>
        ) : null}
        <FormError message={error} className="order-last basis-full" />
      </div>
    </div>
  );
}
