"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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

/** The file Share hands on: its bytes, read before the press (with its name, when the route gives one). */
export type ShareFile = {
  filename: string;
  contentType: string;
  read: () => Promise<{ blob: Blob; filename?: string | null }>;
};

/** The file's bytes as a `File`, under the name the route gives it, else its own. */
export async function readShareFile(share: ShareFile): Promise<File> {
  const { blob, filename } = await share.read();
  return new File([blob], filename || share.filename, {
    type: share.contentType,
  });
}

/**
 * Hands the file itself to the share sheet — a `File`, never its link
 * (`url`). The sheet is asked at once, before any wait, so it is still the
 * press that opens it: a browser lets a page open the sheet only for a few
 * seconds after a press, and refuses it later (`NotAllowedError`). Closing
 * the sheet is the person's choice: no refusal.
 */
export async function shareFile(
  file: File,
  sheet: Pick<Navigator, "share"> = navigator,
): Promise<string | null> {
  try {
    await sheet.share({ files: [file], title: file.name });
    return null;
  } catch (thrown) {
    return thrown instanceof DOMException && thrown.name === "AbortError"
      ? null
      : SHARE_FAILED;
  }
}

/**
 * Share made ready before the press: the file's bytes read at once — a run
 * package's PDF is made on the way, which may take half a minute — and kept.
 * `reading` settles when they are read (the file, or null when the read
 * failed); `press` hands the file kept to the sheet in the press itself
 * (`shareFile`). A read that failed is tried once more in the press, and the
 * sheet asked after it.
 */
export function preparedShare(share: ShareFile) {
  let file: File | null = null;
  const reading = readShareFile(share).then(
    (read) => (file = read),
    () => null,
  );
  return {
    reading,
    ready: () => file,
    press: (sheet: Pick<Navigator, "share"> = navigator) =>
      file
        ? shareFile(file, sheet)
        : readShareFile(share).then(
            (read) => shareFile((file = read), sheet),
            () => SHARE_FAILED,
          ),
  };
}

/** The buttons as the page holds them: Download, each, then Share where it may be. */
export function FileActionsView({
  downloads,
  canShare,
  shareReady,
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
  /** Whether the file is read, so a press opens the sheet at once; Share waits for it. */
  shareReady: boolean;
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
          disabled={busy || !shareReady}
          aria-busy={!shareReady}
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
 * itself — its bytes, read from this site's own route as soon as Share can
 * show (`preparedShare`), so the press opens the sheet at once — never its
 * link, and is shown only where this browser takes that file
 * (`navigator.canShare`; the server draws none). A refusal is said under
 * the buttons.
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
  const shown = share !== null && canShare;
  // The file read once for each file Share sends (its name and type), the
  // newest read kept for the press.
  const latest = useRef(share);
  useEffect(() => {
    latest.current = share;
  });
  const key = shown ? `${share.filename}\n${share.contentType}` : null;
  const [prepared, setPrepared] = useState<{
    key: string;
    share: ReturnType<typeof preparedShare>;
    settled: boolean;
  } | null>(null);
  useEffect(() => {
    if (key === null || !latest.current) return;
    let current = true;
    const made = preparedShare(latest.current);
    setPrepared({ key, share: made, settled: false });
    void made.reading.then(() => {
      if (current) setPrepared({ key, share: made, settled: true });
    });
    return () => {
      current = false;
    };
  }, [key]);
  const ready = prepared !== null && prepared.key === key && prepared.settled;

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
      canShare={shown}
      shareReady={ready}
      busy={busy}
      error={error}
      onAct={(download) => void act(download.run)}
      onShare={() => {
        // The sheet is asked inside this press (`act` calls it at once).
        if (ready && prepared) void act(() => prepared.share.press());
      }}
      before={before}
      testId={testId}
    />
  );
}
