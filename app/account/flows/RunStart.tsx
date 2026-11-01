"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr/Play";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/ssr/RocketLaunch";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { AutomationRunInputField } from "@/lib/automations";
import { setSubscriptionStatus, startRun } from "./actions";
import { RunInputFields } from "./ManifestFields";
import { SPACING } from "@/lib/spacing";
import { perFileForms, runsStarted } from "@/lib/several-files";

/**
 * Step 1 of a flow's page (Build 21, spec A6; the owner's D3: "it should be
 * easy for a user to run something", and his quick-run ask: "they shouldnt
 * have to do a bunch of work in the app"): the run's fields — titles only, no
 * line under them — and Start run, inside the step that receives the
 * document; Turn on in Start run's place while the flow is off, the fields
 * kept so a file given first is not lost. ~~The card's Run button and its Run
 * window~~ until Build 21. The fields are the pinned version's `runInput`
 * (backend ADR-0030), drawn from the manifest, so no flow needs a website
 * change.
 *
 * **One run per key**: a key is made with the form and again whenever a value
 * changes, so only a resubmission of the same values — after an answer was
 * lost — reuses it, and the platform returns the run it already started
 * instead of starting a second one. A file field uploads as soon as a file is
 * chosen; Start run waits for every one. **Nothing is asked first** (the
 * owner's D1: "we dont need to say this at all … the terms and privacy policy
 * includes that information"): a run starts at the press. A started run is
 * somewhere to go: its own page, where its steps arrive.
 *
 * **On an item's page** (backend ADR-0046; plan §5.3) the same form starts a
 * run that names the item (`itemId`): its file, with the accepted types in
 * words beside it, and Start. A run started there stays on the item's page
 * (`onStarted`), where it joins the ranked list as "Reading…", and the form
 * empties for the next file.
 *
 * **Several files** (platform round 2's B2): a file field that declares
 * `multiple` holds several, and Start run starts one run per file with the
 * same other inputs — `startRun` once per file (`perFileForms`), one after
 * another — then stays here, the fields emptied, saying "{n} runs started";
 * a run refused stops the rest and says why, with the count of those already
 * started. One file is a run started as before.
 */
export function RunStart({
  workspaceId,
  subscriptionId,
  runInput,
  live,
  available,
  canGoLive,
  initialKey,
  itemId,
  onStarted,
}: {
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  /** The PINNED version's run input (backend ADR-0030). */
  runInput: AutomationRunInputField[];
  live: boolean;
  /** The platform's evidence that the flow's service answers. */
  available: boolean;
  /** Every account it cannot run without is connected. */
  canGoLive: boolean;
  /**
   * The first run's key, made by the server with the page — so the page and
   * the browser draw the same one; each change of a value makes a new one.
   */
  initialKey: string;
  /** The item every run started here names, on an item's page. */
  itemId?: string;
  /** Called with a started run's id in place of going to its page. */
  onStarted?: (runId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // How many runs the last several-file start started.
  const [started, setStarted] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(initialKey);
  const newRunKey = () => setRunKey(`run-${crypto.randomUUID()}`);
  // A file field uploads as soon as a file is chosen; the run waits for every
  // one. Held per field, so one field's upload ending never speaks for
  // another's still in flight.
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
  const canRun = live && available && runInput.length > 0;

  // Submitted from `onSubmit`, not a form `action`: React resets an action
  // form's fields when the action settles, and a refused run must keep what the
  // person typed — so that resubmitting the same values reuses the same key.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRun || uploading) return;
    const data = new FormData(event.currentTarget);
    data.set("workspaceId", workspaceId);
    setError(null);
    setStarted(null);
    const forms = perFileForms(data);
    if (forms.length > 1) {
      startTransition(async () => {
        let count = 0;
        for (const form of forms) {
          const result = await startRun(form);
          if (!result.ok) {
            setError(result.error);
            if (result.state === "file-unavailable") {
              setFileRound((round) => round + 1);
              newRunKey();
            }
            break;
          }
          count += 1;
          if (result.runId) onStarted?.(result.runId);
        }
        if (count === 0) return;
        setStarted(count);
        if (count === forms.length) {
          setFileRound((round) => round + 1);
          newRunKey();
        }
        if (!onStarted) router.refresh();
      });
      return;
    }
    startTransition(async () => {
      const result = await startRun(forms[0]!);
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
      if (!result.runId) return;
      if (onStarted) {
        // Emptied for the next file, under a new key.
        setFileRound((round) => round + 1);
        newRunKey();
        onStarted(result.runId);
        return;
      }
      router.push(`/account/runs/${result.runId}`);
    });
  };

  const turnOn = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("workspaceId", workspaceId);
      data.set("subscriptionId", subscriptionId);
      data.set("status", "live");
      const result = await setSubscriptionStatus(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (live && !canRun) return null;

  return (
    <form
      data-testid="run-form"
      onSubmit={submit}
      onChange={newRunKey}
      className={`flex flex-col ${SPACING.group.gap}`}
    >
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="idempotencyKey" value={runKey} />
      {itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}
      {runInput.length > 0 ? (
        <RunInputFields
          runInput={runInput}
          workspaceId={workspaceId}
          subscriptionId={subscriptionId}
          onUploadingChange={onUploadingChange}
          fileRound={fileRound}
          showTypes={itemId !== undefined}
        />
      ) : null}
      <FormError message={error} />
      {started !== null ? (
        <p
          role="status"
          data-testid="runs-started"
          className="text-sm text-[var(--success-text)]"
        >
          {runsStarted(started)}
        </p>
      ) : null}
      <div>
        {live ? (
          <Button
            type="submit"
            disabled={pending || uploading}
            className={`inline-flex items-center ${SPACING.inner.gap}`}
          >
            <PlayIcon size={20} aria-hidden />
            {pending
              ? "Starting…"
              : uploading
                ? "Uploading…"
                : itemId
                  ? "Start"
                  : "Start run"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending || !canGoLive || !available}
            onClick={turnOn}
            className={`inline-flex items-center ${SPACING.inner.gap}`}
          >
            <RocketLaunchIcon size={20} aria-hidden />
            {pending ? "Turning on…" : "Turn on"}
          </Button>
        )}
      </div>
    </form>
  );
}
