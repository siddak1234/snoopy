"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr/Play";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { AiConsentCard } from "@/components/account/AiConsentCard";
import { saveAiDocumentReading } from "@/app/account/ai-consent-actions";
import {
  AI_READING_OFF,
  AI_SETTING,
  runCarriesFile,
  runGate,
  type AiChoice,
} from "@/lib/ai-consent";
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
import { setupProblem } from "./setup-check";
import type { VendorChoiceRow } from "./vendor-path";

/**
 * The buttons for one subscription on a flow's card — adding is
 * `AddAutomation`'s, and a workspace holds each flow once (the owner's build
 * 12, #9). Archive flow archives it: it stops, keeps its runs in Activity, and
 * is listed under Archived flows, to be unarchived later (BUILD-PLAN 24.11.11;
 * the owner's word, build 9, and build 12's #4, in the app's words). It ends
 * the flow, so it is red, and so is its confirm; Pause is not, since Resume
 * undoes it (the owner's build 12, #5).
 *
 * A client component only because it holds pending state and the last refusal.
 * The work happens in server actions, so nothing here knows the backend origin
 * and no fetch call is written by hand.
 *
 * A refusal is shown rather than swallowed: "Turn on" can fail because a
 * connection is unmet, which is an answer a person needs, not console noise.
 *
 * **A run with a file on a flow that reads it with AI** waits for the account's
 * answer to "AI reads your documents" (backend ADR-0038; spec §3.H), asked
 * once and kept by the platform — never per run: never answered, the card is
 * asked over the Run window and Allow starts the run; answered Not now, Start
 * run says AI reading is off, and its Turn on allows it and starts the run.
 */
export function AutomationActions({
  name,
  team,
  available,
  usesAi,
  aiDocumentReading,
  setup,
  vendor,
  subscription,
  workspaceId,
}: {
  name: string;
  /** Where the flow is, as its row says it: "Team: Accounting". */
  team: string;
  available: boolean;
  /** Whether a run of this flow may send a file to an AI model (backend ADR-0038). */
  usesAi: boolean;
  /** The account's answer; undefined from a platform that does not ask. */
  aiDocumentReading: AiChoice;
  setup: AutomationSetupField[];
  /** The flow's vendor choice, for Set up's Connect row; null with none to choose. */
  vendor: VendorChoiceRow | null;
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
  // The account's answer: one given here — the card over the Run window, or
  // Turn on — until the page, read again, says it too.
  const [answeredHere, setAnsweredHere] = useState<
    "allowed" | "declined" | undefined
  >(undefined);
  const aiChoice: AiChoice = answeredHere ?? aiDocumentReading;
  // A run held for the account's answer: its form's values as Start run sent
  // them, started as they are once the person allows it.
  const [awaitingConsent, setAwaitingConsent] = useState<FormData | null>(null);
  const runForm = useRef<HTMLFormElement>(null);

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
    setAwaitingConsent(null);
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

  // Set up's save (spec §3.B): an empty amount or required field is said
  // before anything is sent; a vendor chosen and not connected is said with
  // its name; anything else the platform refuses is the action's words.
  const submitSetup = (data: FormData) => {
    setError(null);
    const problem = setupProblem(setup, data);
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(async () => {
      const result = await saveSubscriptionConfiguration(data);
      if (!result.ok) {
        setError(
          result.state === "vendor-not-connected" &&
            vendor?.displayName !== undefined
            ? `Connect ${vendor.displayName} first, or choose None.`
            : result.error,
        );
        return;
      }
      close();
    });
  };

  // A started run is somewhere to go: its own page, where its steps arrive.
  const sendRun = (data: FormData) => {
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

  // A run with a file on a flow that reads it with AI starts only once the
  // account allowed it (spec §3.H). While the card is open nothing else
  // starts a run — not the form sent again.
  const submitRun = (data: FormData) => {
    if (awaitingConsent) return;
    const gate = runGate({
      usesAi,
      carriesFile: runCarriesFile(data),
      choice: aiChoice,
    });
    if (gate === "ask") {
      setAwaitingConsent(data);
      return;
    }
    if (gate === "off") {
      // Said under Start run already; its Turn on is the way on.
      document
        .getElementById(`automation-run-${subscription.id}-ai-on`)
        ?.focus();
      return;
    }
    sendRun(data);
  };

  // Answered over the Run window: Allow starts the run it held, with the
  // values it was held with; Not now starts nothing, and Start run then says
  // AI reading is off.
  const answered = (choice: "allowed" | "declined") => {
    const held = awaitingConsent;
    setAwaitingConsent(null);
    setAnsweredHere(choice);
    if (choice === "allowed" && held) sendRun(held);
  };

  // Turn on (spec §3.H): the account allows it, then the run starts with the
  // form as it is now.
  const allowAndStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveAiDocumentReading("allowed");
      if (!result.ok) {
        setError(AI_SETTING.saveFailed);
        return;
      }
      setAnsweredHere("allowed");
      const form = runForm.current;
      if (!form) return;
      const data = new FormData(form);
      data.set("workspaceId", workspaceId);
      sendRun(data);
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
  const readingOff = usesAi && aiChoice === "declined";

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
            {pending ? "Working…" : "Turn on"}
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
            Set up {name}
          </h2>
          <p
            id={`automation-setup-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            {team}
          </p>
          <form
            onSubmit={fromForm(submitSetup)}
            noValidate
            className="mt-6 space-y-6"
          >
            <input
              type="hidden"
              name="subscriptionId"
              value={subscription.id}
            />
            <SetupFields
              setup={setup}
              config={subscription.config}
              vendor={vendor}
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
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
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
            Fill this in, then start the run.
          </p>
          <form
            ref={runForm}
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
              <Button
                type="submit"
                disabled={pending || uploading}
                className="inline-flex items-center gap-2"
              >
                <PlayIcon size={20} aria-hidden />
                {pending ? "Starting…" : uploading ? "Uploading…" : "Start run"}
              </Button>
            </div>
            {readingOff ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-[var(--muted)]">
                  {AI_READING_OFF.line}
                </p>
                <Button
                  id={`automation-run-${subscription.id}-ai-on`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || uploading}
                  onClick={allowAndStart}
                >
                  {AI_READING_OFF.turnOn}
                </Button>
              </div>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {dialog === "run" && awaitingConsent ? (
        <AiConsentCard
          id={`automation-ai-consent-${subscription.id}`}
          zIndex={110}
          onClose={() => setAwaitingConsent(null)}
          onAnswered={answered}
        />
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
            you can unarchive it later.
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
