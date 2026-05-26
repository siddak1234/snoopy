"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";

// Upload-invoice popup. Collects a file + invoice fields, POSTs them as
// multipart/form-data to /api/invoices/upload, which uploads the PDF to GCS
// and triggers the n8n ingest workflow. Built on the shared Modal / FormInput
// / FormError components (same pattern as CreateProjectDialog) so
// styling/behavior stay consistent.

// Vercel's serverless function body limit is ~4.5 MB; cap at 4 MB so multipart
// overhead doesn't push the request past the limit and the user sees a
// friendly error instead of a server reject.
const MAX_FILE_MB = 4;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type CapturedData = {
  projectId: string;
  invoiceNumber: string;
  invoiceDate: string;
  merchant: string;
  loungeCode: string;
  fileName: string;
};

export function UploadInvoiceDialog({
  open,
  onClose,
  projectId,
  defaultLoungeCode,
  locations,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Pre-selected lounge (the dashboard's current location). */
  defaultLoungeCode: string | null;
  /** Known lounges for the dropdown. */
  locations: string[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [loungeCode, setLoungeCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CapturedData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Lounge options: known locations plus the default (in case it isn't in the
  // current period's list), de-duplicated.
  const loungeOptions = Array.from(
    new Set([...(defaultLoungeCode ? [defaultLoungeCode] : []), ...locations]),
  );

  const reset = useCallback(() => {
    setFile(null);
    setInvoiceNumber("");
    setInvoiceDate("");
    setMerchant("");
    setLoungeCode(defaultLoungeCode ?? "");
    setError(null);
    setCaptured(null);
    setSubmitting(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [defaultLoungeCode]);

  // Reset on open; focus the first field. reset() is deferred via queueMicrotask
  // so setState isn't called synchronously inside the effect body (matches the
  // CreateProjectDialog pattern + satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => reset());
    const t = setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  // Escape closes (Modal handles backdrop + scroll lock).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!file) return setError("Please choose an invoice file.");
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("File must be a PDF.");
    if (file.size > MAX_FILE_MB * 1024 * 1024)
      return setError(`File must be under ${MAX_FILE_MB} MB.`);
    if (!invoiceNumber.trim()) return setError("Invoice number is required.");
    if (!ISO_DATE.test(invoiceDate)) return setError("Invoice date is required.");
    if (!merchant.trim()) return setError("Merchant name is required.");
    if (!loungeCode.trim()) return setError("Lounge code is required.");

    const trimmed: CapturedData = {
      projectId,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      merchant: merchant.trim(),
      loungeCode: loungeCode.trim(),
      fileName: file.name,
    };

    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", trimmed.projectId);
    fd.append("invoiceNumber", trimmed.invoiceNumber);
    fd.append("invoiceDate", trimmed.invoiceDate);
    fd.append("merchant", trimmed.merchant);
    fd.append("loungeCode", trimmed.loungeCode);

    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }
      setCaptured(trimmed);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy="upload-invoice-title"
      bubble
      zIndex={100}
      contentClassName="max-w-lg"
    >
      <h2 id="upload-invoice-title" className="text-xl font-semibold text-[var(--text)]">
        Upload invoice
      </h2>

      {captured ? (
        <>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Uploaded — processing has started. The invoice will appear in the
            list once it's been parsed.
          </p>
          <dl className="mt-4 space-y-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm">
            <Row label="File" value={captured.fileName} />
            <Row label="Invoice #" value={captured.invoiceNumber} />
            <Row label="Date" value={captured.invoiceDate} />
            <Row label="Merchant" value={captured.merchant} />
            <Row label="Lounge" value={captured.loungeCode} />
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="btn-primary inline-flex px-5">
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add an invoice for processing.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* File picker */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)]">
                Invoice file (PDF, max {MAX_FILE_MB} MB){" "}
                <span className="text-[var(--muted)]">(required)</span>
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary inline-flex !min-h-0 !px-4 !py-2 text-sm"
                >
                  Choose file
                </button>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">
                  {file ? file.name : "No file selected"}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <FormInput
              ref={firstFieldRef}
              id="upload-invoice-number"
              label={<>Invoice number <span className="text-[var(--muted)]">(required)</span></>}
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              autoComplete="off"
            />

            <FormInput
              id="upload-invoice-date"
              label={<>Invoice date <span className="text-[var(--muted)]">(required)</span></>}
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />

            <FormInput
              id="upload-merchant"
              label={<>Merchant name <span className="text-[var(--muted)]">(required)</span></>}
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              autoComplete="off"
            />

            {/* Lounge code — dropdown of known lounges, defaulting to current */}
            <div>
              <label htmlFor="upload-lounge" className="block text-sm font-medium text-[var(--text)]">
                Lounge code <span className="text-[var(--muted)]">(required)</span>
              </label>
              {loungeOptions.length > 0 ? (
                <select
                  id="upload-lounge"
                  value={loungeCode}
                  onChange={(e) => setLoungeCode(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] cursor-pointer"
                >
                  <option value="" disabled>
                    Select lounge
                  </option>
                  {loungeOptions.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="upload-lounge"
                  type="text"
                  value={loungeCode}
                  onChange={(e) => setLoungeCode(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                  placeholder="e.g. Air France"
                />
              )}
            </div>

            <FormError message={error} />

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary inline-flex px-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Uploading…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn-secondary inline-flex px-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-[var(--text)]">{value}</dd>
    </div>
  );
}
