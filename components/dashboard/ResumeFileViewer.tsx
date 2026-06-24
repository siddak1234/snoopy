"use client";

import { useState } from "react";

// Resume PDF viewer — embeds the signed-URL redirect route in an iframe (bytes
// stay off Vercel; re-signs on each navigation). Mirrors InvoiceFileViewer.
export function ResumeFileViewer({
  candidateId,
  fileName,
}: {
  candidateId: string;
  fileName?: string | null;
}) {
  const url = `/api/candidates/file?candidateId=${encodeURIComponent(candidateId)}`;
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-[var(--muted)]">
          {fileName ?? "Resume"}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex !min-h-0 !px-3 !py-1.5 text-xs"
          >
            Open in new tab
          </a>
          <a
            href={url}
            download
            className="btn-secondary inline-flex !min-h-0 !px-3 !py-1.5 text-xs"
          >
            Download
          </a>
        </div>
      </div>

      {errored ? (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-4 text-sm text-[var(--error-text)]">
          Could not load this resume.{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open in new tab
          </a>
        </div>
      ) : (
        <div className="relative">
          {!loaded ? (
            <div className="absolute inset-0 z-10 flex animate-pulse items-center justify-center rounded-lg border border-[var(--ring)]/50 bg-[var(--surface-strong)]">
              <span className="text-xs text-[var(--muted)]">Loading resume…</span>
            </div>
          ) : null}
          <iframe
            src={url}
            title="Resume PDF"
            className="w-full min-h-[700px] h-[80vh] rounded-lg border border-[var(--ring)]/50"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </div>
      )}
    </div>
  );
}
