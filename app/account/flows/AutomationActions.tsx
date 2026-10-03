"use client";

import { useCallback, useState, useTransition } from "react";
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
 * The buttons for one subscription on a flow's card — adding is
 * `AddAutomation`'s, since one flow can be added once per team. Archive flow
 * archives it: it stops, keeps its runs in Activity, and is listed under
 * Archived flows (BUILD-PLAN 24.11.11; the owner's word, build 9, in the app's
 * words). It ends the flow, so it is red, and so is its confirm; Pause is not,
 * since Resume undoes it (the owner's build 12, #5).
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
  workspaceId,
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
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
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
  // A file field uploads as soon as a file is chosen; the run waits for every
  // one. Held per field, so one field's upload ending — or one abandoned when
  // the form closed — never speaks for another's still in flight.
  const [uploadingFields, setUploadingFields] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const uploading = uploadingFields.size > 0;
  const onUploadingChange = useCallback((key: string, busy: boolean) => {
    setUploadingFields((current) => {
      if (busy === current.has(key)) return current;
      const next = new Set(current);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  // Bumped to empty the file fields when the platform will not take a file.
  const [fileRound, setFileRound] = useState(0);
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

  // Every action carries the workspace the page showed (register F28, F70).
  const field = (entries: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    data.set("workspaceId", workspaceId);
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
    setUploadingFields(new Set());
  };

  // Submitted from `onSubmit`, not a form `action`: React resets an action form's
  // fields when the action settles, and a refused save or run must keep what the
  // person typed — for the run, so that resubmitting the same values reuses the
  // same idempotency key.
  const fromForm =
    (handler: (data: FormData) => void) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      data.set("workspaceId", workspaceId);
      handler(data);
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
        // A file already used, or gone: its field is emptied to choose again,
        // and the changed input is a new run.
        if (result.state === "file-unavailable") {
          setFileRound((round) => round + 1);
          newRunKey();
        }
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
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => open("archive")}
        >
          Archive flow
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
            Flow setup
          </h2>
          <p
            id={`automation-setup-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Complete the settings supplied by this flow.
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
            <RunInputFields
              runInput={subscription.runInput}
              workspaceId={workspaceId}
              subscriptionId={subscription.id}
              onUploadingChange={onUploadingChange}
              fileRound={fileRound}
            />
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
              <Button type="submit" disabled={pending || uploading}>
                {pending ? "Starting…" : uploading ? "Uploading…" : "Start run"}
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
            It stops and moves to Archived flows. Its runs stay in Activity, and
            you can add it again later.
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
            <Button
              type="button"
              variant="danger"
              onClick={confirmArchive}
              disabled={pending}
            >
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
