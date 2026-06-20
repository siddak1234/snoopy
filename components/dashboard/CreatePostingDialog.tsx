"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { FilePicker } from "@/components/ui/FilePicker";

// Create-job-posting popup. A posting is a (role, department) opening with a
// job-description PDF. Built on the same shared Modal / FormInput / FormError /
// FilePicker primitives as the upload modals so styling/behavior stay identical.
//
// MOCK/local-state scope: the JD PDF is validated but NOT persisted. Department
// is picked from the project's existing departments OR created via "Other".

const MAX_FILE_MB = 4;
// Sentinel select value for the "create a new department" branch.
const OTHER = "__other__";

export function CreatePostingDialog({
  open,
  onClose,
  departments,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Existing departments in this project — the dropdown options. */
  departments: string[];
  onCreate: (input: {
    role: string;
    department: string;
    jobDescriptionFileName: string;
  }) => void;
}) {
  const [role, setRole] = useState("");
  const [departmentChoice, setDepartmentChoice] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{
    role: string;
    department: string;
    fileName: string;
  } | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setRole("");
    setDepartmentChoice("");
    setNewDepartment("");
    setFile(null);
    setError(null);
    setCaptured(null);
  }, []);

  // Reset on open; focus the first field. reset() is deferred via queueMicrotask
  // so setState isn't called synchronously inside the effect body.
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

  const creatingNew = departmentChoice === OTHER;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedRole = role.trim();
    if (!trimmedRole) return setError("Role is required.");

    const department = creatingNew ? newDepartment.trim() : departmentChoice;
    if (!department)
      return setError(
        creatingNew
          ? "New department name is required."
          : "Department is required.",
      );

    if (!file) return setError("Please choose a job-description PDF.");
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("Job description must be a PDF.");
    if (file.size > MAX_FILE_MB * 1024 * 1024)
      return setError(`File must be under ${MAX_FILE_MB} MB.`);

    onCreate({ role: trimmedRole, department, jobDescriptionFileName: file.name });
    setCaptured({ role: trimmedRole, department, fileName: file.name });
  }

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy="create-posting-title"
      bubble
      zIndex={100}
      contentClassName="max-w-lg"
    >
      <h2
        id="create-posting-title"
        className="text-xl font-semibold text-[var(--text)]"
      >
        New job posting
      </h2>

      {captured ? (
        <>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Posting created — you can now upload candidates into it.
          </p>
          <dl className="mt-4 space-y-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm">
            <Row label="Role" value={captured.role} />
            <Row label="Department" value={captured.department} />
            <Row label="Job description" value={captured.fileName} />
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
        <>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open a role for this client and attach its job description.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <FormInput
              ref={firstFieldRef}
              id="posting-role"
              label={
                <>
                  Role <span className="text-[var(--muted)]">(required)</span>
                </>
              }
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              autoComplete="off"
              placeholder="e.g. Senior Data Engineer"
            />

            {/* Department — pick an existing one or create a new via "Other". */}
            <div>
              <label
                htmlFor="posting-department"
                className="block text-sm font-medium text-[var(--text)]"
              >
                Department <span className="text-[var(--muted)]">(required)</span>
              </label>
              <select
                id="posting-department"
                value={departmentChoice}
                onChange={(e) => setDepartmentChoice(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
              >
                <option value="" disabled>
                  Select a department
                </option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value={OTHER}>Other (create new)…</option>
              </select>
            </div>

            {creatingNew ? (
              <FormInput
                id="posting-new-department"
                label={
                  <>
                    New department{" "}
                    <span className="text-[var(--muted)]">(required)</span>
                  </>
                }
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                autoComplete="off"
                placeholder="e.g. Data Platform"
              />
            ) : null}

            {/* Job description — PDF only (shared FilePicker; validated on submit). */}
            <FilePicker
              id="posting-jd"
              label={
                <>
                  Job description (PDF, max {MAX_FILE_MB} MB){" "}
                  <span className="text-[var(--muted)]">(required)</span>
                </>
              }
              value={file}
              onChange={setFile}
            />

            <FormError message={error} />

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" className="btn-primary inline-flex px-5">
                Create posting
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary inline-flex px-5"
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
