"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";

/**
 * A small "Remove" that asks first, then runs one server action and refreshes
 * the page. For an undoable removal of one thing from a list — a person from a
 * team, a team's access to a project (backend §12.1 #174). Nothing here is
 * one-way: the same person or team can be added again, which is why a plain
 * confirmation suffices where deleting a project asks for a typed word.
 *
 * The removed row takes this button with it, so focus is handed to
 * `focusAfter` — the id of the list's heading, which stays. A removal that
 * takes the page away from the person (a manager leaving their own team, which
 * they then cannot see) goes to `redirectAfter` instead, as leaving a project
 * does.
 */
export function ConfirmRemoveButton({
  label,
  busyLabel,
  title,
  description,
  confirmLabel,
  action,
  focusAfter,
  redirectAfter,
}: {
  /** The button, e.g. "Remove". */
  label: string;
  busyLabel: string;
  /** The question, naming exactly what goes. */
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<{ ok: true } | { ok: false; error: string }>;
  focusAfter: string;
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleId = `remove-${label}-${title}`.replace(/[^a-z0-9-]/giu, "-");

  const confirm = () => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (redirectAfter) {
        router.push(redirectAfter);
        return;
      }
      document.getElementById(focusAfter)?.focus();
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={pending}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-60"
      >
        {pending ? busyLabel : label}
      </button>
      {open ? (
        <Modal
          onClose={() => setOpen(false)}
          ariaLabelledBy={`${titleId}-title`}
          ariaDescribedBy={`${titleId}-desc`}
          bubble
          zIndex={105}
          dismissible={!pending}
        >
          <h2
            id={`${titleId}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            {title}
          </h2>
          <p
            id={`${titleId}-desc`}
            className="mt-2 text-sm text-[var(--muted)]"
          >
            {description}
          </p>
          {error ? <FormError message={error} className="mt-3" /> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? busyLabel : confirmLabel}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
