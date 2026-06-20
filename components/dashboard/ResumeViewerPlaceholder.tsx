// Placeholder resume viewer. Mirrors the framed look of InvoiceFileViewer (the
// header action row + bordered rounded document frame) but renders a static
// "no document store connected" state instead of an <iframe> to a signed URL —
// the Resume Reviewer has no storage bucket yet. When a bucket lands, this swaps
// for the same iframe/signed-URL approach InvoiceFileViewer already uses.
//
// Presentational only (no hooks / handlers), so it renders fine in a server
// component. Does NOT import or modify InvoiceFileViewer.

export function ResumeViewerPlaceholder({
  fileName,
}: {
  /** Uploaded resume file name, shown as the document caption. */
  fileName?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-[var(--muted)]">
          {fileName ? fileName : "No resume on file"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Available once a document store is connected"
            className="btn-secondary inline-flex !min-h-0 cursor-not-allowed !px-3 !py-1.5 text-xs opacity-50"
          >
            Open in new tab
          </button>
          <button
            type="button"
            disabled
            title="Available once a document store is connected"
            className="btn-secondary inline-flex !min-h-0 cursor-not-allowed !px-3 !py-1.5 text-xs opacity-50"
          >
            Download
          </button>
        </div>
      </div>

      <div className="flex min-h-[700px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--ring)] bg-[var(--surface-strong)] px-6 py-10 text-center">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-[var(--muted)]"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
        <p className="text-sm font-medium text-[var(--text)]">
          Resume preview
        </p>
        <p className="max-w-sm text-xs text-[var(--muted)]">
          {fileName
            ? `“${fileName}” will render here once a document store is connected.`
            : "The resume PDF will render here once a document store is connected."}
        </p>
      </div>
    </div>
  );
}
