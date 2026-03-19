"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { leaveProjectAction } from "@/app/account/projects/actions";

export function LeaveProjectButton({
  projectId,
  projectName,
  redirectAfterLeave,
}: {
  projectId: string;
  projectName: string;
  /** If set, navigate here after successful leave (e.g. from project detail page). */
  redirectAfterLeave?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  function reset() {
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  function onOpen() {
    setError(null);
    setConfirmText("");
    setOpen(true);
  }

  function onConfirm() {
    if (!canConfirm || pending) return;
    startTransition(async () => {
      const result = await leaveProjectAction(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      if (redirectAfterLeave) router.push(redirectAfterLeave);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        disabled={pending}
        className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] dark:hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
      >
        {pending ? "Leaving…" : "Leave project"}
      </button>

      {open ? (
        <Modal
          onClose={reset}
          ariaLabelledBy="leave-project-title"
          ariaDescribedBy="leave-project-desc"
          bubble
          zIndex={105}
        >
          <h2
            id="leave-project-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Leave “{projectName}”?
          </h2>
          <p id="leave-project-desc" className="mt-1 text-sm text-[var(--muted)]">
            You will be removed from this project. To confirm, type{" "}
            <span className="font-semibold text-[var(--text)]">DELETE</span>.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="leave-project-confirm"
                className="block text-sm font-medium text-[var(--text)]"
              >
                Confirmation
              </label>
              <input
                id="leave-project-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
                placeholder="Type DELETE"
                disabled={pending}
                className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)]/50 outline-none transition focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirm();
                }}
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="btn-secondary inline-flex px-5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm || pending}
                className="btn-primary inline-flex px-5 disabled:opacity-50 disabled:pointer-events-none"
              >
                {pending ? "Leaving…" : "Leave project"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

