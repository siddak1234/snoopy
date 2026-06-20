"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shared file-picker control: a labeled "Choose file" button + filename label
 * over a visually-hidden native <input type="file">. Extracted from the inline
 * blocks in UploadInvoiceDialog / UploadCandidateDialog so the same picker UI
 * isn't re-drawn per modal (the candidate + posting modals use this one).
 *
 * Controlled: the parent owns the File via `value` / `onChange`. When the parent
 * clears it (e.g. a modal reset sets value to null) the native input is cleared
 * too, so re-opening the modal shows "No file selected".
 *
 * This component does NOT validate — callers validate on submit so they keep
 * their own copy ("Resume must be a PDF." vs "Job description must be a PDF.").
 */
export function FilePicker({
  id,
  label,
  value,
  onChange,
  accept = "application/pdf,.pdf",
  buttonLabel = "Choose file",
  emptyLabel = "No file selected",
}: {
  id?: string;
  label: ReactNode;
  value: File | null;
  onChange: (file: File | null) => void;
  /** Accept attribute for the native input. Defaults to PDF. */
  accept?: string;
  buttonLabel?: string;
  emptyLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // Keep the native input in sync when the parent clears the value.
  useEffect(() => {
    if (value === null && ref.current) ref.current.value = "";
  }, [value]);

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text)]">{label}</label>
      <div className="mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="btn-secondary inline-flex !min-h-0 !px-4 !py-2 text-sm"
        >
          {buttonLabel}
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">
          {value ? value.name : emptyLabel}
        </span>
      </div>
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
