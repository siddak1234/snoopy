"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { FilePicker } from "@/components/ui/FilePicker";

// Upload-candidate popup. Collects a name + resume PDF, POSTs them (with the
// inherited project + role + department) to /api/candidates/upload, which
// forwards to the candidate n8n webhook for screening + insert into
// resume_review. Built on the same shared Modal / FormInput / FormError / FilePicker
// primitives as UploadInvoiceDialog so styling/behavior stay identical.
//
// Role + Company/Department are inherited from the dashboard's current filter
// selection (shown read-only) and are never asked here.

// Match the invoice modal's 4 MB cap so the file-size message stays consistent.
const MAX_FILE_MB = 4;

export function UploadCandidateDialog({
  open,
  onClose,
  projectId,
  role,
  company,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** The project the candidate is uploaded into — the tenancy key. */
  projectId: string;
  /** Inherited from the dashboard's current Role filter — shown read-only, not asked. */
  role: string;
  /** Inherited from the dashboard's current Company / Department filter — shown read-only. */
  company: string;
  /** Optimistically add the candidate to the dashboard list on success. */
  onAdd: (input: { name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captured, setCaptured] = useState<{ name: string; fileName: string } | null>(
    null,
  );
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setName("");
    setFile(null);
    setError(null);
    setSubmitting(false);
    setCaptured(null);
  }, []);

  // Reset on open; focus the first field. reset() is deferred via queueMicrotask
  // so setState isn't called synchronously inside the effect body (matches the
  // UploadInvoiceDialog pattern + satisfies react-hooks/set-state-in-effect).
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

    const trimmedName = name.trim();
    if (!trimmedName) return setError("Candidate name is required.");
    if (!file) return setError("Please choose a resume PDF.");
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("Resume must be a PDF.");
    if (file.size > MAX_FILE_MB * 1024 * 1024)
      return setError(`File must be under ${MAX_FILE_MB} MB.`);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);
    fd.append("name", trimmedName);
    fd.append("role", role);
    fd.append("department", company);

    setSubmitting(true);
    try {
      const res = await fetch("/api/candidates/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }
      onAdd({ name: trimmedName });
      setCaptured({ name: trimmedName, fileName: file.name });
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
      ariaLabelledBy="upload-candidate-title"
      bubble
      zIndex={100}
      contentClassName="max-w-lg"
    >
      <h2
        id="upload-candidate-title"
        className="text-xl font-semibold text-[var(--text)]"
      >
        Upload candidate
      </h2>

      {/* Role + Company/Department are inherited from the dashboard filters and
          shown read-only — never asked. */}
      <p className="mt-1 text-sm text-[var(--muted)]">
        Adding to{" "}
        <span className="font-medium text-[var(--text)]">{role}</span> ·{" "}
        <span className="font-medium text-[var(--text)]">{company}</span>
      </p>

      {captured ? (
        <>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Added — the candidate is in the list, pending AI screening.
          </p>
          <dl className="mt-4 space-y-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm">
            <Row label="Name" value={captured.name} />
            <Row label="Resume" value={captured.fileName} />
            <Row label="Role" value={role} />
            <Row label="Company / Dept" value={company} />
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary inline-flex px-5"
            >
              Done
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormInput
            ref={firstFieldRef}
            id="upload-candidate-name"
            label={
              <>
                Candidate name{" "}
                <span className="text-[var(--muted)]">(required)</span>
              </>
            }
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />

          {/* Resume picker — PDF only (shared FilePicker; validated on submit). */}
          <FilePicker
            id="upload-candidate-resume"
            label={
              <>
                Resume (PDF, max {MAX_FILE_MB} MB){" "}
                <span className="text-[var(--muted)]">(required)</span>
              </>
            }
            value={file}
            onChange={setFile}
          />

          <FormError message={error} />

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Uploading…" : "Add candidate"}
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
