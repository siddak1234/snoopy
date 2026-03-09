"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { joinProjectByCodeAction } from "@/app/account/projects/actions";
import Modal from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function JoinProjectDialog({ open, onClose, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setError(null);
    setPending(false);
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      // Defer to avoid synchronous state updates inside the effect body.
      queueMicrotask(() => reset());
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const code = (form.elements.namedItem("code") as HTMLInputElement)?.value;
    if (code == null || String(code).trim() === "") {
      setError("Enter the access code.");
      setPending(false);
      return;
    }
    const result = await joinProjectByCodeAction(String(code));
    setPending(false);
    if (result.ok) {
      onClose();
      onSuccess?.();
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  const dialogContent = (
    <Modal
      onClose={onClose}
      ariaLabelledBy="join-project-title"
      ariaDescribedBy="join-project-desc"
      bubble
      zIndex={100}
    >
      <h2 id="join-project-title" className="text-xl font-semibold text-[var(--text)]">
          Join team project
        </h2>
        <p id="join-project-desc" className="mt-1 text-sm text-[var(--muted)]">
          Enter the access code shared by the project owner.
        </p>
        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="join-code" className="block text-sm font-medium text-[var(--text)]">
              Access code
            </label>
            <input
              ref={inputRef}
              id="join-code"
              name="code"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. ABCD1234"
              disabled={pending}
              className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60 font-mono uppercase"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={pending} className="btn-primary inline-flex px-5">
              {pending ? "Joining…" : "Join project"}
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
    </Modal>
  );

  return typeof document !== "undefined"
    ? createPortal(dialogContent, document.body)
    : null;
}
