"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { WorkspaceExportJob } from "@/lib/exports";
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
 * Everything, as one file (backend §12.1 #39) — no section cut at 250 rows.
 *
 * The platform assembles it while the page waits, then answers a link that is
 * signed for minutes. So the link is asked for again at the moment of the
 * download rather than kept from when the file became ready: one fetched
 * earlier may have expired by the time it is clicked. The file itself is kept
 * for a day.
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

  const download = () => {
    if (!job) return;
    setError(null);
    startTransition(async () => {
      const result = await readCompleteExport(workspaceId, job.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJob(result.job);
      if (result.job.file) window.location.assign(result.job.file.downloadUrl);
    });
  };

  const running = job?.status === "running";

  return (
    <div className="mt-4">
      <p className="text-sm text-[var(--muted)]">
        Or export everything as one file, however large the workspace. It takes
        a moment to prepare and is kept for a day.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || running}
          onClick={start}
        >
          {running ? "Preparing everything…" : "Export everything"}
        </Button>
        {job?.status === "ready" ? (
          <Button size="sm" disabled={pending} onClick={download}>
            Download file
          </Button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm">
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
      <FormError message={error} className="mt-2" />
    </div>
  );
}
