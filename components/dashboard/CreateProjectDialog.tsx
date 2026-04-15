"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createProjectAction } from "@/app/account/projects/actions";
import Modal from "@/components/ui/Modal";

const PROJECT_TYPES = [
  "Invoice Processing",
  "Document Review",
  "Data Entry Automation",
  "GL Code Classification",
  "Custom Workflow",
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after the user closes the success view; use to revalidate + router.refresh(). */
  onSuccess?: () => void | Promise<void>;
  /** When provided, the project is created in this specific workspace. */
  workspaceId?: string;
};

export function CreateProjectDialog({ open, onClose, onSuccess, workspaceId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setError(null);
    setPending(false);
    setCreated(false);
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => reset());
      return;
    }
    const t = setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  const handleClose = useCallback(async () => {
    if (created) {
      await Promise.resolve(onSuccess?.());
    }
    onClose();
  }, [created, onClose, onSuccess]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createProjectAction(formData);
    setPending(false);
    if (result.ok) {
      setCreated(true);
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  const dialogContent = (
    <Modal
      onClose={handleClose}
      ariaLabelledBy="create-project-title"
      ariaDescribedBy={created ? "create-project-success-desc" : "create-project-desc"}
      bubble
      zIndex={100}
    >
      <h2 id="create-project-title" className="text-xl font-semibold text-[var(--text)]">
        Create project
      </h2>

      {created ? (
        <>
          <p id="create-project-success-desc" className="mt-1 text-sm text-[var(--muted)]">
            Your project was created. Use the project page to invite team members.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn-primary inline-flex px-5"
            >
              Done
            </button>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <p id="create-project-desc" className="mt-1 text-sm text-[var(--muted)]">
            Add a new project to your workspace.
          </p>
          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-[var(--text)]">
                Project name <span className="text-[var(--muted)]">(required)</span>
              </label>
              <input
                ref={nameInputRef}
                id="project-name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder="My project"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="project-type" className="block text-sm font-medium text-[var(--text)]">
                Project type <span className="text-[var(--muted)]">(required)</span>
              </label>
              <div className="relative mt-1.5">
                <select
                  id="project-type"
                  name="projectType"
                  required
                  disabled={pending}
                  defaultValue=""
                  className="w-full appearance-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60 cursor-pointer"
                >
                  <option value="" disabled className="text-[var(--muted)]">
                    Select project type
                  </option>
                  {PROJECT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-[var(--text)]">
                Description <span className="text-[var(--muted)]">(optional)</span>
              </label>
              <textarea
                id="project-description"
                name="description"
                rows={3}
                maxLength={140}
                placeholder="Max 140 characters"
                disabled={pending}
                className="mt-1.5 w-full resize-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
              />
            </div>
            {workspaceId ? (
              <input type="hidden" name="workspaceId" value={workspaceId} />
            ) : null}
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="btn-primary inline-flex px-5"
              >
                {pending ? "Creating…" : "Create project"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
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

  return typeof document !== "undefined"
    ? createPortal(dialogContent, document.body)
    : null;
}
