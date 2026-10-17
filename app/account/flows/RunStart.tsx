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
 */
export function RunStart({
  workspaceId,
  subscriptionId,
  runInput,
  live,
  available,
  canGoLive,
  initialKey,
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
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
      if (result.runId) router.push(`/account/runs/${result.runId}`);
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
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="idempotencyKey" value={runKey} />
      {runInput.length > 0 ? (
        <RunInputFields
          runInput={runInput}
          workspaceId={workspaceId}
          subscriptionId={subscriptionId}
          onUploadingChange={onUploadingChange}
          fileRound={fileRound}
        />
      ) : null}
      <FormError message={error} />
      <div>
        {live ? (
          <Button
            type="submit"
            disabled={pending || uploading}
            className="inline-flex items-center gap-2"
          >
            <PlayIcon size={20} aria-hidden />
            {pending ? "Starting…" : uploading ? "Uploading…" : "Start run"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending || !canGoLive || !available}
            onClick={turnOn}
            className="inline-flex items-center gap-2"
          >
            <RocketLaunchIcon size={20} aria-hidden />
            {pending ? "Turning on…" : "Turn on"}
          </Button>
        )}
      </div>
    </form>
  );
}
