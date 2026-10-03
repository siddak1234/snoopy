"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { cancelRun } from "@/app/account/flows/actions";

/**
 * Cancel a run that has not ended (`cancelRun`). Rendered only for a `pending`
 * or `running` run — the two states the platform cancels — and confirmed first,
 * because a cancelled run is not resumed: it ends where it stands.
 */
export function CancelRunButton({
  runId,
  workspaceId,
}: {
  runId: string;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(null);
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.append("runId", runId);
      data.append("workspaceId", workspaceId);
      const result = await cancelRun(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The action revalidates this run's page, which re-renders it cancelled.
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Cancel run
      </Button>
      {open ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy="cancel-run-title"
          ariaDescribedBy="cancel-run-description"
          zIndex={100}
        >
          <h2
            id="cancel-run-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Cancel this run?
          </h2>
          <p
            id="cancel-run-description"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            It stops where it is and is not resumed. Steps it already finished
            stay finished.
          </p>
          <FormError message={error} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={pending}
            >
              Keep it running
            </Button>
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? "Cancelling…" : "Cancel run"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
