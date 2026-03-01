"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { joinProjectByCodeAction } from "@/app/account/projects/actions";

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
      reset();
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
    const code = (form.elements.namedItem("code") as HTMLInputElement)?.value?.trim();
    if (!code) {
      setError("Enter the access code.");
      setPending(false);
      return;
    }
    const result = await joinProjectByCodeAction(code);
    setPending(false);
    if (result.ok) {
      onClose();
      onSuccess?.();
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="join-project-title"
        aria-describedby="join-project-desc"
        className="relative w-full max-w-md rounded-3xl border border-[var(--ring)] bg-[var(--surface)] p-6 shadow-xl [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]"
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
      </div>
    </div>
  );
}
