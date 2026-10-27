"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PlatformApiError, siteFileBlob } from "@/lib/platform-api";
import {
  COULD_NOT_SHOW,
  FILE_GONE,
  FILE_OPENING,
  TRY_AGAIN,
} from "@/lib/run-files";
import { SPACING } from "@/lib/spacing";

/**
 * A picture of one of the run's own files (backend ADR-0048 amendment 1,
 * decision 2): the image block's file, read once from its page's own view
 * route (`fileViewHref`, the file page's checks: this site's pages alone,
 * never cached, `nosniff`) through `siteFileBlob`, which reads `/account/`
 * paths only — so the address is built from the block's typed target, never
 * from its words. A JPEG or a PNG is drawn up to 480 px tall, whole, inside a
 * link to its file's page; a PDF (a scanned page) in a frame 480 px tall, as
 * the file page frames one. The object URL is let go when the picture leaves
 * the page. Its words are the file page's (`lib/run-files.ts`), the app's
 * too: while it is read, when the file is no longer kept, and any other
 * failure with Try again.
 */

/** What a picture draws: nothing yet (the server's), reading, the file, or why not. */
export type PictureState =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "shown"; url: string }
  | { kind: "gone" }
  | { kind: "failed" };

/** One read of the file: its bytes, or why there are none. */
export type PictureRead =
  { kind: "shown"; blob: Blob } | { kind: "gone" } | { kind: "failed" };

/** Reads the file once: a 404 is a file no longer kept, any other refusal a failure. */
export async function readPicture(
  view: string,
  read: (path: string) => Promise<Blob> = siteFileBlob,
): Promise<PictureRead> {
  try {
    return { kind: "shown", blob: await read(view) };
  } catch (error) {
    return error instanceof PlatformApiError && error.status === 404
      ? { kind: "gone" }
      : { kind: "failed" };
  }
}

/** A picture's frame: the column's width, 480 px tall at most. */
const FRAME =
  "block w-full rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]";

/**
 * A picture as its state draws it, with no hooks: the words for each state,
 * the image inside its page's link, or the PDF's frame.
 */
export function PictureView({
  state,
  alt,
  page,
  pdf,
  onRetry,
}: {
  state: PictureState;
  alt: string;
  /** The file's page on this site. */
  page: string;
  /** A scanned page: drawn in a frame, not as an image. */
  pdf: boolean;
  onRetry: () => void;
}) {
  if (state.kind === "shown")
    return pdf ? (
      <iframe
        data-testid="block-image"
        title={alt}
        src={state.url}
        className={`${FRAME} h-[480px]`}
      />
    ) : (
      <Link
        prefetch={false}
        href={page}
        data-testid="block-image"
        className="block"
      >
        {/* The bytes are this site's own route's, drawn from an object URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.url}
          alt={alt}
          className={`${FRAME} max-h-[480px] object-contain`}
        />
      </Link>
    );
  const words =
    state.kind === "opening"
      ? FILE_OPENING
      : state.kind === "gone"
        ? FILE_GONE
        : state.kind === "failed"
          ? COULD_NOT_SHOW
          : null;
  return (
    <div
      data-testid="block-image"
      data-state={state.kind}
      className={`${FRAME} flex min-h-32 flex-col items-start justify-center ${SPACING.inner.gap} ${SPACING.card.all}`}
    >
      {words ? (
        <p
          role={state.kind === "opening" ? "status" : undefined}
          className="text-sm text-[var(--muted)]"
        >
          {words}
        </p>
      ) : null}
      {state.kind === "failed" ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {TRY_AGAIN}
        </Button>
      ) : null}
    </div>
  );
}

const noSubscription = () => () => {};

/**
 * The picture, live: read once when drawn, and again on Try again. The
 * server draws it empty (no words: its words are its state's, and the server
 * reads nothing); the browser reads it, saying so while it does.
 */
export function Picture({
  alt,
  page,
  view,
  pdf,
}: {
  alt: string;
  page: string;
  /** The page's own route that hands the file on (`…/view`). */
  view: string;
  pdf: boolean;
}) {
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [reads, setReads] = useState(0);
  // The answer to one read, by its number: a read again is "opening" until it answers.
  const [answer, setAnswer] = useState<{
    read: number;
    state: PictureState;
  } | null>(null);

  useEffect(() => {
    let live = true;
    let url: string | null = null;
    void readPicture(view).then((read) => {
      if (!live) return;
      if (read.kind === "shown") {
        url = URL.createObjectURL(read.blob);
        setAnswer({ read: reads, state: { kind: "shown", url } });
      } else setAnswer({ read: reads, state: read });
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [view, reads]);

  const state: PictureState = !inBrowser
    ? { kind: "idle" }
    : answer?.read === reads
      ? answer.state
      : { kind: "opening" };
  return (
    <PictureView
      state={state}
      alt={alt}
      page={page}
      pdf={pdf}
      onRetry={() => setReads((count) => count + 1)}
    />
  );
}
