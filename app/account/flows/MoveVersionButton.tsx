"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type { AutomationSetupField } from "@/lib/automations";
import { moveSubscriptionVersion, moveWithConfiguration } from "./actions";
import { SetupFields } from "./ManifestFields";

/**
 * Moves a subscription to the catalog's newest version (backend §12.1 #126).
 *
 * The platform re-checks the settings and the connected accounts against the
 * version it moves to, and refuses while an approval still waits on the one it
 * runs now; each refusal is said in words by the action. The history stays:
 * runs already made are the old version's, and nothing is re-added.
 *
 * Once moved, this button goes with the version note it sits in, so focus is
 * handed to `focusAfter` — the id of something the card keeps.
 *
 * **Settings that do not fit the new version are set for it here** (backend
 * §12.1 #185): refused `invalid_config`, the dialog offers that version's fields,
 * seeded from what the flow holds, and saving them moves the flow in the same
 * change. Set up cannot do it: it draws the version the flow runs.
 */
export function MoveVersionButton({
  workspaceId,
  subscriptionId,
  name,
  from,
  to,
  config,
  targetSetup,
  focusAfter,
}: {
  /** The workspace this page shows; the move is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  name: string;
  from: number;
  to: number;
  /** What the flow holds now: the seed for the new version's settings. */
  config: Record<string, unknown>;
  /** The setup fields of the version it moves to. */
  targetSetup: AutomationSetupField[];
  focusAfter: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Refused `invalid_config`: the dialog can set the new version's settings.
  const [misfit, setMisfit] = useState(false);
  // Showing the new version's fields, whose save moves the flow.
  const [settingFor, setSettingFor] = useState(false);
  const titleId = `move-${subscriptionId}-title`;

  const moved = () => {
    setOpen(false);
    setSettingFor(false);
    setMisfit(false);
    document.getElementById(focusAfter)?.focus();
  };

  const saveAndMove = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      data.set("workspaceId", workspaceId);
      data.set("subscriptionId", subscriptionId);
      data.set("templateVersion", String(to));
      const result = await moveWithConfiguration(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      moved();
    });
  };

  const confirm = () => {
    setError(null);
    setMisfit(false);
    startTransition(async () => {
      const data = new FormData();
      data.append("workspaceId", workspaceId);
      data.append("subscriptionId", subscriptionId);
      data.append("templateVersion", String(to));
      const result = await moveSubscriptionVersion(data);
      if (!result.ok) {
        setError(result.error);
        setMisfit(result.state === "settings-misfit" && targetSetup.length > 0);
        return;
      }
      moved();
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
          setMisfit(false);
          setSettingFor(false);
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
          dismissible={!pending}
        >
          {settingFor ? (
            <form onSubmit={saveAndMove} className="flex flex-col gap-3">
              <h2
                id={titleId}
                className="text-xl font-semibold text-[var(--text)]"
              >
                Settings for v{to}
              </h2>
              <p id={`${titleId}-desc`} className="text-sm text-[var(--muted)]">
                v{to} checks its settings differently. Set them for it; saving
                moves the flow.
              </p>
              <SetupFields setup={targetSetup} config={config} />
              <FormError message={error} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Moving…" : `Save and move to v${to}`}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <h2
                id={titleId}
                className="text-xl font-semibold text-[var(--text)]"
              >
                Move {name} to v{to}?
              </h2>
              <p
                id={`${titleId}-desc`}
                className="mt-1 text-sm text-[var(--muted)]"
              >
                New runs use v{to}; runs v{from} already made are kept as they
                are. Its settings carry over and are checked against v{to}{" "}
                first.
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
                {misfit ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSettingFor(true);
                    }}
                  >
                    Set them for v{to}
                  </Button>
                ) : (
                  <Button type="button" onClick={confirm} disabled={pending}>
                    {pending ? "Moving…" : `Move to v${to}`}
                  </Button>
                )}
              </div>
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}
