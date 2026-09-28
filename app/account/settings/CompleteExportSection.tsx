"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { WorkspaceExportJob } from "@/lib/exports";
import { readCompleteExport, startCompleteExport } from "./export-actions";

/** How often a running export is asked about. */
const POLL_MS = 2_000;

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
 */
export function CompleteExportSection() {
  const [pending, startTransition] = useTransition();
  const [job, setJob] = useState<WorkspaceExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const follow = (exportId: string) => {
    timer.current = setTimeout(async () => {
      const result = await readCompleteExport(exportId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJob(result.job);
      if (result.job.status === "running") follow(exportId);
    }, POLL_MS);
  };

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await startCompleteExport();
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
      const result = await readCompleteExport(job.id);
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
