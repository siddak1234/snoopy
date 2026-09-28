"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type {
  AutomationRunInputField,
  AutomationSetupField,
  SubscriptionStatus,
} from "@/lib/automations";
import {
  archiveSubscription,
  saveSubscriptionConfiguration,
  setSubscriptionStatus,
  startRun,
  type ActionResult,
} from "./actions";
import { RunInputFields, SetupFields } from "./ManifestFields";

/**
 * The buttons for one subscription on an automation card — adding is
 * `AddAutomation`'s, since one automation can hold a subscription per project.
 *
 * A client component only because it holds pending state and the last refusal.
 * The work happens in server actions, so nothing here knows the backend origin
 * and no fetch call is written by hand.
 *
 * A refusal is shown rather than swallowed: "Go live" can fail because a
 * connection is unmet, which is an answer a person needs, not console noise.
 */
export function AutomationActions({
  name,
  available,
  setup,
  subscription,
}: {
  name: string;
  available: boolean;
  setup: AutomationSetupField[];
  subscription: {
    id: string;
    status: SubscriptionStatus;
    canGoLive: boolean;
    config: Record<string, unknown>;
    /** The PINNED version's run input (backend ADR-0030); absent means no Run. */
    runInput?: AutomationRunInputField[];
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"setup" | "run" | "archive" | null>(
    null,
  );
  // One run per key: made when the Run dialog opens and again whenever a value
  // changes, so only a resubmission of the same values reuses it.
  const [runKey, setRunKey] = useState("");
  const newRunKey = () => setRunKey(`run-${crypto.randomUUID()}`);

  const submit = (
    action: (data: FormData) => Promise<ActionResult>,
    data: FormData,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) setError(result.error);
    });
  };

  const field = (entries: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    return data;
  };

  const open = (which: "setup" | "run" | "archive") => {
    setError(null);
    if (which === "run") newRunKey();
    setDialog(which);
  };
  const close = () => {
    setDialog(null);
    setError(null);
  };

  // Submitted from `onSubmit`, not a form `action`: React resets an action form's
  // fields when the action settles, and a refused save or run must keep what the
  // person typed — for the run, so that resubmitting the same values reuses the
  // same idempotency key.
  const fromForm =
    (handler: (data: FormData) => void) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handler(new FormData(event.currentTarget));
    };

  const submitSetup = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await saveSubscriptionConfiguration(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  // A started run is somewhere to go: its own page, where its steps arrive.
  const submitRun = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await startRun(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      if (result.runId) router.push(`/account/runs/${result.runId}`);
    });
  };

  const confirmArchive = () => {
    setError(null);
    startTransition(async () => {
      const result = await archiveSubscription(
        field({ subscriptionId: subscription.id }),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  // Run is offered only where it can be honest: a live subscription whose pinned
  // version declares what a run needs. A version that declares nothing gets no
  // form, because the platform could not check one (ADR-0030).
  const canRun =
    subscription.status === "live" &&
    (subscription.runInput?.length ?? 0) > 0 &&
    available;

  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canRun ? (
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => open("run")}
          >
            Run
          </Button>
        ) : null}
        {setup.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => open("setup")}
          >
            Set up
          </Button>
        ) : null}
        {subscription.status !== "live" ? (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || !subscription.canGoLive || !available}
            onClick={() =>
              submit(
                setSubscriptionStatus,
                field({ subscriptionId: subscription.id, status: "live" }),
              )
            }
          >
            {pending ? "Working…" : "Go live"}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              submit(
                setSubscriptionStatus,
                field({
                  subscriptionId: subscription.id,
                  status: "paused",
                }),
              )
            }
          >
            {pending ? "Working…" : "Pause"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => open("archive")}
        >
          Archive
        </Button>
      </div>

      {error && dialog === null ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      {dialog === "setup" ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy={`automation-setup-${subscription.id}-title`}
          ariaDescribedBy={`automation-setup-${subscription.id}-description`}
          zIndex={100}
        >
          <h2
            id={`automation-setup-${subscription.id}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            Automation setup
          </h2>
          <p
            id={`automation-setup-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Complete the settings supplied by this automation.
          </p>
          <form onSubmit={fromForm(submitSetup)} className="mt-6 space-y-6">
            <input
              type="hidden"
              name="subscriptionId"
              value={subscription.id}
            />
            <SetupFields setup={setup} config={subscription.config} />
            <FormError message={error} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save setup"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "run" && subscription.runInput ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy={`automation-run-${subscription.id}-title`}
          ariaDescribedBy={`automation-run-${subscription.id}-description`}
          zIndex={100}
        >
          <h2
            id={`automation-run-${subscription.id}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            Run {name}
          </h2>
          <p
            id={`automation-run-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Enter what this run needs. It starts as soon as you submit, and its
            page shows each step as it happens.
          </p>
          <form
            onSubmit={fromForm(submitRun)}
            onChange={newRunKey}
            className="mt-6 space-y-6"
          >
            <input
              type="hidden"
              name="subscriptionId"
              value={subscription.id}
            />
            <input type="hidden" name="idempotencyKey" value={runKey} />
            <RunInputFields runInput={subscription.runInput} />
            <FormError message={error} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Starting…" : "Start run"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "archive" ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy={`automation-archive-${subscription.id}-title`}
          ariaDescribedBy={`automation-archive-${subscription.id}-description`}
          zIndex={100}
        >
          <h2
            id={`automation-archive-${subscription.id}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            Archive {name}?
          </h2>
          <p
            id={`automation-archive-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            It stops running and gives its plan slot back. This cannot be
            undone: to use it again, add it afresh. Runs it already made stay in
            Activity.
          </p>
          <FormError message={error} />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmArchive} disabled={pending}>
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
