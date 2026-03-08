"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createProjectAction } from "@/app/account/projects/actions";
import Modal from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called when user closes the access-code view; use to revalidate + router.refresh(). */
  onSuccess?: () => void | Promise<void>;
};

export function CreateProjectDialog({ open, onClose, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setError(null);
    setPending(false);
    setAccessCode(null);
    setCopied(false);
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const t = setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  const handleClose = useCallback(async () => {
    if (accessCode) {
      await Promise.resolve(onSuccess?.());
    }
    onClose();
  }, [accessCode, onClose, onSuccess]);

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
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createProjectAction(formData);
    setPending(false);
    if (result.ok) {
      setAccessCode(result.accessCode);
    } else {
      setError(result.error);
    }
  }

  async function copyCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!accessCode) return;
    try {
      if (typeof navigator?.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(accessCode);
      } else {
        const input = document.createElement("input");
        input.value = accessCode;
        input.readOnly = true;
        input.setAttribute("aria-hidden", "true");
        input.style.position = "fixed";
        input.style.opacity = "0";
        input.style.pointerEvents = "none";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  const dialogContent = (
    <Modal
      onClose={handleClose}
      ariaLabelledBy="create-project-title"
      ariaDescribedBy={accessCode ? "create-project-access-code-desc" : "create-project-desc"}
      bubble
      zIndex={100}
    >
      <h2 id="create-project-title" className="text-xl font-semibold text-[var(--text)]">
          Create project
        </h2>

        {accessCode ? (
          <>
            <p id="create-project-access-code-desc" className="mt-1 text-sm text-[var(--muted)]">
              Project created. Share this access code with your team so they can join.
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3">
                <code className="min-w-0 flex-1 truncate font-mono text-lg tracking-wider text-[var(--text)]">
                  {accessCode}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-[var(--muted)]">
                This code is shown once. Store it securely; you can generate a new one later from the project.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-primary inline-flex px-5"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-sm text-[var(--muted)] underline hover:text-[var(--text)]"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
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
                <label htmlFor="project-description" className="block text-sm font-medium text-[var(--text)]">
                  Description <span className="text-[var(--muted)]">(optional)</span>
                </label>
                <textarea
                  id="project-description"
                  name="description"
                  rows={3}
                  placeholder="Brief description"
                  disabled={pending}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
                />
              </div>
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
