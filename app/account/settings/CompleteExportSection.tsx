"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileActions } from "@/components/dashboard/FileActions";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { WorkspaceExportJob } from "@/lib/exports";
import {
  COMPLETE_EXPORT_INTRO,
  downloadFileLabel,
  exportFiles,
} from "@/lib/export-contract";
import { siteFileNamed } from "@/lib/platform-api";
import { DOWNLOAD_FAILED, shareHref } from "@/lib/run-documents";
import { typeOfName } from "@/lib/run-files";
import { followSignedLink } from "@/lib/signed-link";
import { SPACING } from "@/lib/spacing";
import { readCompleteExport, startCompleteExport } from "./export-actions";

/** How often a running export is asked about. */
const POLL_MS = 2_000;

/**
 * How many reads in a row may fail before the page stops asking, each after
 * twice the wait of the one before. Then the failure is said and Export
 * everything is offered again: asking again answers the export already
 * running, so nothing is started twice.
 */
const FAILED_READS_ALLOWED = 3;

/** A reason code the platform names, in words. */
const FAILURES: Record<string, string> = {
  interrupted: "The export was interrupted. Start it again.",
  too_large: "The workspace is larger than one export file may be.",
  not_configured: "Exports are not available here.",
};

/**
 * Everything (backend §12.1 #39) — no section cut at 250 rows — as one file,
 * or a large workspace as several (§12.1 #181): "Download file {n} of {N}"
 * for each, in order, and Share only for an export of one file, the one the
 * site's share route reads.
 *
 * The platform assembles it while the page waits, then answers a link that is
 * signed for minutes. So the link is asked for again at the moment of the
 * download rather than kept from when the file became ready: one fetched
 * earlier may have expired by the time it is clicked. The file itself is kept
 * for a day. A link that is not https is never followed, and the page says it
 * could not download (`followSignedLink`; Build 25, the review's R5c 2).
 * Download file, then Share, the file itself, read through this site's own
 * route when Share is first pressed — never before (`FileActions`; the
 * owner's F4 and Q7).
 *
 * `workspaceId` is the workspace the page shows: every call is refused once
 * another tab has made a different one active (register F28).
 */
export function CompleteExportSection({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [job, setJob] = useState<WorkspaceExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Off the page: a read still in flight when it goes schedules nothing after.
  const gone = useRef(false);

  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      clearTimeout(timer.current);
    };
  }, []);

  const follow = (exportId: string, failedReads = 0) => {
    timer.current = setTimeout(
      async () => {
        // A read the browser could not even send is a failed read, not an
        // unhandled rejection that stops the following unseen.
        const result = await readCompleteExport(workspaceId, exportId).catch(
          () => ({
            ok: false as const,
            error: "The export could not be checked just now.",
          }),
        );
        if (gone.current) return;
        if (!result.ok) {
          if (failedReads + 1 < FAILED_READS_ALLOWED) {
            follow(exportId, failedReads + 1);
            return;
          }
          setJob(null);
          setError(result.error);
          return;
        }
        setJob(result.job);
        if (result.job.status === "running") follow(exportId);
      },
      POLL_MS * 2 ** failedReads,
    );
  };

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await startCompleteExport(workspaceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJob(result.job);
      if (result.job.status === "running") follow(result.job.id);
    });
  };

  // The file at `index`, by a link asked for at the press.
  const download = (index: number) => async (): Promise<string | null> => {
    if (!job) return null;
    const result = await readCompleteExport(workspaceId, job.id).catch(() => ({
      ok: false as const,
      error: DOWNLOAD_FAILED,
    }));
    if (!result.ok) return result.error;
    setJob(result.job);
    const file = exportFiles(result.job)[index];
    return file && !followSignedLink(file.downloadUrl) ? DOWNLOAD_FAILED : null;
  };

  const running = job?.status === "running";
  const files = job?.status === "ready" ? exportFiles(job) : [];

  return (
    <div className={SPACING.group.top}>
      <p className="text-sm text-[var(--muted)]">{COMPLETE_EXPORT_INTRO}</p>
      <div
        className={`${SPACING.inner.top} flex flex-wrap ${SPACING.inner.gap}`}
      >
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || running}
          onClick={start}
        >
          {running ? "Preparing everything…" : "Export everything"}
        </Button>
        {job && files.length > 0 ? (
          <FileActions
            testId="complete-export-actions"
            downloads={files.map((_, index) => ({
              label: downloadFileLabel(index + 1, files.length),
              run: download(index),
              disabled: pending,
            }))}
            share={
              files.length === 1
                ? {
                    filename: files[0]!.filename,
                    contentType: typeOfName(files[0]!.filename),
                    read: () => siteFileNamed(shareHref({ exportId: job.id })),
                  }
                : null
            }
          />
        ) : null}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`${SPACING.inner.top} text-sm`}
      >
        {job?.status === "ready"
          ? job.complete
            ? "Ready. The file holds the whole workspace."
            : "Ready, but partial: a part of the workspace could not be read, and the file says which."
          : job?.status === "failed"
            ? (FAILURES[job.failureReason ?? ""] ??
              "The export could not be made.")
            : job?.status === "expired"
              ? "That file has been removed. Export again for a new one."
              : null}
      </p>
      <FormError message={error} className={SPACING.inner.top} />
    </div>
  );
}
