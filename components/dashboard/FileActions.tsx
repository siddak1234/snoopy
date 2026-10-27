"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { siteFileNamed } from "@/lib/platform-api";
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

/** A file's bytes, with the name the route gives it (or null). */
export type FileBytes = { blob: Blob; filename?: string | null };

/**
 * The file Share hands on: its name and type, and either `held` — the bytes
 * the page itself already read (its frame's), null while it reads them — or
 * `read`, where the page holds none, which reads them only when Share is
 * pressed.
 */
export type ShareFile = {
  filename: string;
  contentType: string;
} & (
  | { held: FileBytes | null; read?: undefined }
  | { read: () => Promise<FileBytes>; held?: undefined }
);

/** Bytes as a `File`, under the name the route gives them, else the file's own. */
function asFile(share: ShareFile, { blob, filename }: FileBytes): File {
  return new File([blob], filename || share.filename, {
    type: share.contentType,
  });
}

/** The file's bytes, read (`read`) or held, as a `File`. */
export async function readShareFile(share: ShareFile): Promise<File> {
  return asFile(share, share.read ? await share.read() : share.held!);
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
 * One press of Share, as the app's (it reads only when Share is pressed).
 * The bytes the page holds, or the file an earlier press read (`kept`), go
 * to the sheet in the press itself. Else this press reads the file — nothing
 * is read before it — and keeps it, and the next press opens the sheet: a
 * browser opens it only in a press, never after a wait. Answers the file to
 * keep, and the refusal's words or null.
 */
export async function pressShare(
  share: ShareFile,
  kept: File | null,
  sheet: Pick<Navigator, "share"> = navigator,
): Promise<{ kept: File | null; error: string | null }> {
  const ready = share.held ? asFile(share, share.held) : kept;
  if (ready) return { kept: ready, error: await shareFile(ready, sheet) };
  if (!share.read) return { kept: null, error: null };
  try {
    return { kept: await readShareFile(share), error: null };
  } catch {
    return { kept: null, error: SHARE_FAILED };
  }
}

/**
 * A file the page reads once, in the browser, to show in its frame and to
 * share (`held`): its bytes from this site's own route, and an address of
 * them for the frame (`url`, let go when the page goes). `failed` when the
 * read failed: the frame then asks the route itself, which says why, and
 * Share reads when pressed. Nothing on the server, and nothing for null.
 */
export function usePageFile(href: string | null): {
  held: FileBytes | null;
  url: string | null;
  failed: boolean;
} {
  const [answer, setAnswer] = useState<{
    href: string;
    held: FileBytes | null;
    url: string | null;
  } | null>(null);
  useEffect(() => {
    if (href === null) return;
    let live = true;
    let url: string | null = null;
    void siteFileNamed(href).then(
      (read) => {
        if (!live) return;
        url = URL.createObjectURL(read.blob);
        setAnswer({ href, held: read, url });
      },
      () => {
        if (live) setAnswer({ href, held: null, url: null });
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [href]);
  const current = answer !== null && answer.href === href ? answer : null;
  return {
    held: current?.held ?? null,
    url: current?.url ?? null,
    failed: current !== null && current.held === null,
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
  /** False while the file is read (the page's own read, or the press's): Share waits, busy. */
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
 * itself — the bytes the page already holds (`held`), else read from this
 * site's own route at the first press, Share busy, and handed to the sheet
 * at the next (`pressShare`); nothing is read before a press — never its
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
  // The file a press read, kept for the next press, for each file Share
  // sends (its name and type).
  const key = shown ? `${share.filename}\n${share.contentType}` : null;
  const [kept, setKept] = useState<{ key: string; file: File } | null>(null);
  const [reading, setReading] = useState(false);
  const keptFile = kept !== null && kept.key === key ? kept.file : null;
  // The page still reads the bytes it holds.
  const waiting = share !== null && share.held === null;

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
      shareReady={!waiting && !reading}
      busy={busy}
      error={error}
      onAct={(download) => void act(download.run)}
      onShare={() => {
        if (share === null || key === null || waiting) return;
        // The sheet is asked inside this press (`act` calls it at once).
        void act(async () => {
          const reads = !share.held && keptFile === null;
          if (reads) setReading(true);
          try {
            const pressed = await pressShare(share, keptFile);
            if (reads && pressed.kept) setKept({ key, file: pressed.kept });
            return pressed.error;
          } finally {
            if (reads) setReading(false);
          }
        });
      }}
      before={before}
      testId={testId}
    />
  );
}
