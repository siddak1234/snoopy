"use client";

import { useMemo, useState } from "react";

// Extension detection runs on the URL-encoded filename — encoded chars don't
// affect the trailing extension. Lowercased to accept ".PDF" etc.
function detectKind(filename: string): "pdf" | "image" | "other" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  ) {
    return "image";
  }
  return "other";
}

export function InvoiceFileViewer({
  filename,
  loungeCode,
}: {
  filename: string;
  loungeCode: string;
}) {
  // The API route returns a 307 redirect to a short-lived signed GCS URL.
  // Iframe / img follow the redirect transparently. Embedding the API path
  // (rather than the signed URL) keeps bytes off Vercel and re-signs on each
  // navigation — sidestepping the 5-min signed-URL expiry for long views.
  const url = useMemo(
    () =>
      `/api/invoices/file?file=${encodeURIComponent(filename)}&lounge=${encodeURIComponent(
        loungeCode,
      )}`,
    [filename, loungeCode],
  );
  const kind = useMemo(() => detectKind(filename), [filename]);

  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showSkeleton = (kind === "pdf" || kind === "image") && !loaded && !errored;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
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

      {errored ? (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-4 text-sm text-[var(--error-text)]">
          Could not load this file.{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open in new tab
          </a>
        </div>
      ) : kind === "other" ? (
        <div className="rounded-lg border border-[var(--ring)]/50 px-3 py-4 text-sm text-[var(--muted)]">
          Preview not available for this file type.{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--text)]"
          >
            Open file
          </a>
        </div>
      ) : (
        <div
          className={`relative ${
            showSkeleton && kind === "image" ? "min-h-[400px]" : ""
          }`}
        >
          {showSkeleton ? (
            <div className="absolute inset-0 z-10 flex animate-pulse items-center justify-center rounded-lg border border-[var(--ring)]/50 bg-[var(--surface-strong)]">
              <span className="text-xs text-[var(--muted)]">Loading file…</span>
            </div>
          ) : null}
          {kind === "pdf" ? (
            <iframe
              src={url}
              title="Invoice PDF"
              className="w-full h-[800px] rounded-lg border border-[var(--ring)]/50"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Invoice"
              className="w-full rounded-lg border border-[var(--ring)]/50"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
