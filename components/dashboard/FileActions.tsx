"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { SHARE_FAILED } from "@/lib/run-files";
import { SPACING } from "@/lib/spacing";

/** The word on Share. */
export const SHARE = "Share";

const noSubscription = () => () => {};

/** Whether this browser hands a file of this name and type to the share sheet. */
export function sharesFiles(filename: string, contentType: string): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File([""], filename, { type: contentType })],
      })
    );
  } catch {
    return false;
  }
}

/** One Download: its words, and what it does — its refusal's words, or null. */
export type DownloadAction = {
  label: string;
  run: () => Promise<string | null>;
  disabled?: boolean;
};

/** The file Share hands on: its bytes when pressed (with its name, when the route gives one). */
export type ShareFile = {
  filename: string;
  contentType: string;
  read: () => Promise<{ blob: Blob; filename?: string | null }>;
};

/**
 * Hands the file itself to the share sheet: its bytes, read when pressed,
 * as a `File` — never its link (`url`) — under the name the route gives it,
 * else its own. Closing the sheet is the person's choice: no refusal.
 */
export async function shareFile(
  share: ShareFile,
  sheet: Pick<Navigator, "share"> = navigator,
): Promise<string | null> {
  try {
    const { blob, filename } = await share.read();
    const name = filename || share.filename;
    await sheet.share({
      files: [new File([blob], name, { type: share.contentType })],
      title: name,
    });
    return null;
  } catch (thrown) {
    return thrown instanceof DOMException && thrown.name === "AbortError"
      ? null
      : SHARE_FAILED;
  }
}

/** The buttons as the page holds them: Download, each, then Share where it may be. */
export function FileActionsView({
  downloads,
  canShare,
  busy,
  error,
  onAct,
  onShare,
  before,
  testId = "file-actions",
}: {
  downloads: readonly DownloadAction[];
  /** Whether Share shows: this browser takes the file (`navigator.canShare`). */
  canShare: boolean;
  busy: boolean;
  error: string | null;
  onAct: (download: DownloadAction) => void;
  onShare: () => void;
  before?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`flex flex-wrap items-center ${SPACING.inner.gap}`}
    >
      {before}
      {downloads.map((download) => (
        <Button
          key={download.label}
          variant="secondary"
          size="sm"
          disabled={busy || download.disabled === true}
          onClick={() => onAct(download)}
          className={`inline-flex items-center ${SPACING.inner.gap}`}
        >
          <DownloadSimpleIcon size={20} aria-hidden />
          {download.label}
        </Button>
      ))}
      {canShare ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={onShare}
          className={`inline-flex items-center ${SPACING.inner.gap}`}
        >
          <ShareNetworkIcon size={20} aria-hidden />
          {SHARE}
        </Button>
      ) : null}
      <FormError message={error} className="order-last basis-full" />
    </div>
  );
}

/**
 * Download, then Share, on every document (the owner's F4 and Q7, both
 * clients): the file pages, a run package's PDF and Excel, and Settings ›
 * Data's two exports. Download is the document's own; Share sends the file
 * itself — its bytes, read from this site's own route when pressed — to the
 * share sheet (`shareFile`), never its link, and is shown only where this
 * browser takes that file (`navigator.canShare`; the server draws none). A
 * refusal is said under the buttons.
 */
export function FileActions({
  downloads,
  share,
  before,
  testId,
}: {
  downloads: readonly DownloadAction[];
  /** The file Share sends, or null for none. */
  share: ShareFile | null;
  /** Drawn first, before the downloads: View package. */
  before?: ReactNode;
  testId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canShare = useSyncExternalStore(
    noSubscription,
    () => (share ? sharesFiles(share.filename, share.contentType) : false),
    () => false,
  );

  const act = async (work: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setError(await work());
    } finally {
      setBusy(false);
    }
  };

  return (
    <FileActionsView
      downloads={downloads}
      canShare={share !== null && canShare}
      busy={busy}
      error={error}
      onAct={(download) => void act(download.run)}
      onShare={() => {
        if (share) void act(() => shareFile(share));
      }}
      before={before}
      testId={testId}
    />
  );
}
