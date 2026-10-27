"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { leaveProjectAction } from "@/app/account/teams/actions";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";

export function LeaveProjectButton({
  projectId,
  projectName,
  redirectAfterLeave,
}: {
  projectId: string;
  projectName: string;
  /** If set, navigate here after successful leave (e.g. from the team's page). */
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

  // Leaving ends a person's place on the team, so the button and its confirm
  // are red, as Delete is (the owner's build 12, #5).
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        disabled={pending}
        className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--error-text)] transition hover:bg-[var(--error-bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
      >
        {pending ? "Leaving…" : "Leave department"}
      </button>

      {open ? (
        <Modal
          onClose={reset}
          ariaLabelledBy="leave-project-title"
          ariaDescribedBy="leave-project-desc"
          bubble
          zIndex={105}
          dismissible={!pending}
        >
          <h2
            id="leave-project-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Leave “{projectName}”?
          </h2>
          <p
            id="leave-project-desc"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            You will be removed from this department and stop seeing its flows.
            To confirm, type{" "}
            <span className="font-semibold text-[var(--text)]">DELETE</span>.
          </p>

          <div className="mt-4 space-y-4">
            <FormInput
              id="leave-project-confirm"
              label="Confirmation"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              disabled={pending}
              className="placeholder:text-[var(--muted)]/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm();
              }}
            />

            <FormError message={error} />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={reset}
                disabled={pending}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm || pending}
                variant="danger"
                className="disabled:pointer-events-none disabled:opacity-50"
              >
                {pending ? "Leaving…" : "Leave department"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
