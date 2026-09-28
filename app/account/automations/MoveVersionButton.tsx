"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { moveSubscriptionVersion } from "./actions";

/**
 * Moves a subscription to the catalog's newest version (backend §12.1 #126).
 *
 * The platform re-checks the settings and the connected accounts against the
 * version it moves to, and refuses while an approval still waits on the one it
 * runs now; each refusal is said in words by the action. The history stays:
 * runs already made are the old version's, and nothing is re-added.
 */
export function MoveVersionButton({
  subscriptionId,
  name,
  from,
  to,
}: {
  subscriptionId: string;
  name: string;
  from: number;
  to: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleId = `move-${subscriptionId}-title`;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.append("subscriptionId", subscriptionId);
      data.append("templateVersion", String(to));
      const result = await moveSubscriptionVersion(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Move to v{to}
      </Button>
      {open ? (
        <Modal
          onClose={() => setOpen(false)}
          bubble
          ariaLabelledBy={titleId}
          ariaDescribedBy={`${titleId}-desc`}
          zIndex={100}
        >
          <h2 id={titleId} className="text-xl font-semibold text-[var(--text)]">
            Move {name} to v{to}?
          </h2>
          <p
            id={`${titleId}-desc`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            New runs use v{to}; runs v{from} already made are kept as they are.
            Its settings carry over and are checked against v{to} first.
          </p>
          <FormError message={error} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? "Moving…" : `Move to v${to}`}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
