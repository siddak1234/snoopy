"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr/Play";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/ssr/RocketLaunch";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { AutomationRunInputField } from "@/lib/automations";
import type { AgreementOffer } from "@/lib/health-agreement";
import { runPagePath } from "@/lib/run-progress";
import { FLOW_CHANGE_ADMIN_ONLY } from "@/lib/subscription-entitlements";
import { setSubscriptionStatus, startRun } from "./actions";
import { HealthAgreementDialog } from "./HealthAgreementDialog";
import { RunInputFields } from "./ManifestFields";
import { SPACING } from "@/lib/spacing";

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
 * words beside it, and Start (`itemPage`). A run started there opens its
 * page from the item (`runPagePath`), its steps arriving, and its back
 * returns to the item (the owner's G4, build 31: "Shoukd i be taken into a
 * step by step"; ~~it stayed on the item's page, the form emptied for the
 * next file~~ until then). Home's YOUR FLOWS starts a run of an item chosen
 * there with Start run, and opens its page (the owner's build 34 F5).
 *
 * Turning a flow on is a change only an owner or admin makes (backend §12.1
 * #180): to a member Turn on is read-only, with "Only an owner or admin can
 * change this flow."; a member still starts runs.
 *
 * A run of a flow that carries health data is refused until the workspace's
 * owner accepts the health data agreement (backend ADR-0049, C3-b): the owner
 * reads and accepts it in `HealthAgreementDialog`, whose "Accept and start
 * run" sends the same values under the same key again; anyone else sees "Ask
 * your workspace owner to accept the health data agreement.". The dialog is
 * drawn beside the form, never in it, so its fields are not the run's.
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
  itemPage = false,
  canChange = true,
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
  /** The item every run started here names: an item's page's, or the one Home's YOUR FLOWS chose. */
  itemId?: string;
  /** On an item's page: its button says Start, and the run opens from the item. */
  itemPage?: boolean;
  /** An owner or admin: a member's Turn on is read-only. */
  canChange?: boolean;
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
  // The agreement to accept, and the run it refused, as it was sent.
  const [offer, setOffer] = useState<{
    agreement: AgreementOffer;
    data: FormData;
  } | null>(null);
  const canRun = live && available && runInput.length > 0;

  /** One run as `data` holds it: its refusal in words, or null once it went or the dialog opened. */
  const send = async (data: FormData): Promise<string | null> => {
    const result = await startRun(data);
    if (!result.ok) {
      if (result.agreement) {
        setOffer({ agreement: result.agreement, data });
        return null;
      }
      // A file already used, or gone: its field is emptied to choose again,
      // and the changed input is a new run.
      if (result.state === "file-unavailable") {
        setFileRound((round) => round + 1);
        newRunKey();
      }
      return result.error;
    }
    if (result.runId) router.push(runPagePath(result.runId, itemPage));
    return null;
  };

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
      setError(await send(data));
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
    <>
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
                  : itemPage
                    ? "Start"
                    : "Start run"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending || !canGoLive || !available || !canChange}
              onClick={turnOn}
              className={`inline-flex items-center ${SPACING.inner.gap}`}
            >
              <RocketLaunchIcon size={20} aria-hidden />
              {pending ? "Turning on…" : "Turn on"}
            </Button>
          )}
        </div>
        {live || canChange ? null : (
          <p className="text-xs text-[var(--muted)]">
            {FLOW_CHANGE_ADMIN_ONLY}
          </p>
        )}
      </form>
      {offer ? (
        <HealthAgreementDialog
          key={offer.agreement.sha256}
          offer={offer.agreement}
          workspaceId={workspaceId}
          purpose="run"
          onAccepted={() => send(offer.data)}
          onClose={() => setOffer(null)}
        />
      ) : null}
    </>
  );
}
