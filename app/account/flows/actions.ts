"use server";

import { revalidatePath } from "next/cache";
import { PlatformServerError } from "@/lib/platform-server";
import {
  archiveItem as archiveWorkspaceItem,
  cancelRun as cancelWorkspaceRun,
  createItem as createWorkspaceItem,
  createRun,
  createSubscription,
  decideApproval as decideWorkspaceApproval,
  listSubscriptions,
  updateFlowEmailRecipients,
  updateSubscription,
  type CreateRunRequest,
  type CreateSubscriptionRequest,
  type DecideApprovalRequest,
  type FlowEmailRecipients,
  type Item,
  type UpdateSubscriptionRequest,
} from "@/lib/automations";
import { VENDOR_MEMBER_NOTE } from "@/lib/connection-rows";
import { EMAIL_SAVE_FAILED } from "@/lib/flow-email";
import { problemFields } from "@/lib/flow-items";
import { heldCopy } from "@/lib/held-flow";
import { overPlanRefusal } from "@/lib/plan-limit";
import { subscriptionEntitlementState } from "@/lib/subscription-entitlements";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";
import { uploadRefusalMessage } from "./upload-refusals";

/**
 * Mutations on the automation surface.
 *
 * **Flows is revalidated with every page under it** (`"layout"`): a flow's
 * own page, its Set up, its Connect integration page and its email page show
 * what the mutation changed as well as the list does (Build 21, spec A6).
 *
 * **A path is revalidated only when the mutation succeeded.** Revalidating after a
 * refusal re-renders the page, and under a platform that is refusing requests
 * (backend §12.1 #160) that re-render is the "busy" panel — replacing the dialog,
 * its refusal and what the person typed. A refusal changed nothing to re-read.
 *
 * **Each acts on the workspace the page showed** (register F28, F70). The form
 * carries the id the page rendered as `workspaceId`; it is only compared with the
 * session's active workspace, and the path always uses the one the server
 * resolves. After a switch in another tab the two differ, and the action refuses
 * in words rather than writing into a workspace the person was not looking at —
 * an Add or a Connect would succeed there — or reading another's 404 as this
 * page's answer.
 *
 * **Resolved inside each action's `try`** (backend §12.1 #160): the session read
 * throws when the platform refuses it, and an action that rejected would take the
 * page to its error boundary and lose what the person typed; a refusal is shown
 * in place instead.
 */

export type ActionResult =
  | { ok: true; subscriptionId?: string; runId?: string }
  | {
      ok: false;
      error: string;
      state?:
        | "plan-limit"
        | "entitlements-unavailable"
        | "file-unavailable"
        // A save that chose a vendor the workspace has not connected, on a
        // live flow (backend ADR-0037): said with the vendor's name.
        | "vendor-not-connected"
        // A change only an owner or admin may make, refused: said in the
        // platform's words (Build 23's B3).
        | "forbidden";
    };

/** The workspace the page showed, which the form sends (register F28). */
function shownWorkspace(formData: FormData): string {
  return String(formData.get("workspaceId") ?? "");
}

/** Turns a refusal into something renderable, and lets the unexpected surface. */
async function attempt(
  formData: FormData,
  run: (workspaceId: string) => Promise<unknown>,
): Promise<ActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await run(workspaceId);
    return { ok: true };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

function subscriptionFailure(error: unknown): ActionResult {
  if (!(error instanceof PlatformServerError)) throw error;

  // The automation contract intentionally exposes only these two reason tokens
  // for a subscription entitlement refusal. Every other 403 is authorization,
  // not a pricing or upgrade signal.
  const state = subscriptionEntitlementState(error.status, error.details);
  if (state === "plan-limit") {
    return {
      ok: false,
      error: "This workspace has reached its current plan limit.",
      state: "plan-limit",
    };
  }
  if (state === "entitlements-unavailable") {
    return {
      ok: false,
      error:
        "Subscriptions are unavailable while billing entitlements are not configured.",
      state: "entitlements-unavailable",
    };
  }
  return { ok: false, error: error.message };
}

/** A second copy of a flow the workspace holds (the owner, build 12's #9). */
const ALREADY_IN_WORKSPACE = "This flow is already in this workspace.";

/**
 * An add the platform could not make (spec §3.A): a workspace or a team it
 * could not find or make answers 404, and a team service that did not answer
 * 502 — neither is something the person can change but by trying again.
 */
const ADD_REFUSED = "Could not add this flow. Try again.";

export async function subscribeToAutomation(
  formData: FormData,
): Promise<ActionResult> {
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { ok: false, error: "A flow is required" };
  // No team is sent (backend ADR-0036): the platform puts the flow in the team
  // of its category, made when the workspace has none, and puts the person
  // adding it on that team. A team sent would be ignored, so none is.
  const body: CreateSubscriptionRequest = { templateId };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    // A workspace holds each flow once (the owner, build 12's #9): a page
    // drawn before another tab or person added the flow is refused here, in
    // words, and nothing is sent. Only what this person may see is listed: a
    // copy in a team hidden from them is the platform's to refuse.
    const { subscriptions } = await listSubscriptions(workspaceId);
    if (heldCopy(subscriptions, templateId))
      return { ok: false, error: ALREADY_IN_WORKSPACE };
    const response = await createSubscription(workspaceId, body);
    revalidatePath("/account/flows", "layout");
    revalidatePath("/account/teams");
    return { ok: true, subscriptionId: response.subscription.id };
  } catch (error) {
    if (
      error instanceof PlatformServerError &&
      (error.status === 404 || error.status === 502)
    ) {
      return { ok: false, error: ADD_REFUSED };
    }
    return subscriptionFailure(error);
  }
}

/**
 * Writes the metadata-driven configuration unchanged except for the primitive
 * conversion the selected control requires. The server remains the validator
 * for declared keys, required/default rules, and every automation-specific
 * constraint.
 */
/**
 * The values a manifest-driven form posted, converted to the type each control
 * promises — the one conversion both the setup form and the run form need
 * (`ManifestFields.tsx` names every value `<prefix>:<key>` and its control
 * `<prefix>-control:<key>`). An empty text or money field is left out, so the
 * platform applies the manifest's own default or refuses a required one.
 */
function declaredValues(
  formData: FormData,
  prefix: "config" | "input",
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const [name, control] of formData.entries()) {
    if (!name.startsWith(`${prefix}-control:`) || typeof control !== "string")
      continue;

    const key = name.slice(`${prefix}-control:`.length);
    const value = formData.get(`${prefix}:${key}`);
    if (control === "toggle") {
      values[key] = value === "true";
      continue;
    }
    if (typeof value !== "string" || value.trim() === "") continue;
    values[key] = control === "money" ? Number(value) : value;
  }
  return values;
}

/**
 * Set up's one button (Build 21; the owner's AM4: "set up page is initial …
 * set up should be made simple"): every setting the page holds — each step's
 * vendor and the few settings, each posted as `config:<key>` — saved whole;
 * for a draft, with the flow turned on in the same change (`turnOn`), and for
 * a flow on or paused, its status kept. A vendor chosen and not connected is
 * said by the page, which knows its name (`vendor-not-connected`); a turn-on
 * refused by the plan in the platform's words for it; anything else in the
 * button's own words. A workspace switched away in another tab is said as it
 * is everywhere.
 */
export async function saveSetup(formData: FormData): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };
  const turnOn = formData.get("turnOn") === "true";
  const config = declaredValues(formData, "config");
  const body: UpdateSubscriptionRequest = turnOn
    ? { config, status: "live" }
    : { config };
  const refused = turnOn ? TURN_ON_REFUSED : SAVE_REFUSED;
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await updateSubscription(
      workspaceId,
      subscriptionId,
      body,
      turnOn ? "status" : "subscription-config",
    );
    revalidatePath("/account/flows", "layout");
    return { ok: true, subscriptionId };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 422 && error.details?.reason === "unmet_connections")
      return { ok: false, error: refused, state: "vendor-not-connected" };
    if (turnOn) {
      const entitlement = subscriptionEntitlementState(
        error.status,
        error.details,
      );
      if (entitlement === "plan-limit")
        return {
          ok: false,
          error: overPlanRefusal(error.details),
          state: "plan-limit",
        };
    }
    return { ok: false, error: refused };
  }
}

/**
 * The vendor page's save (spec A2): the flow's settings as the platform
 * holds them, with ONE step's `connection` setting — the vendor it chose, or
 * `none` — changed. The platform replaces a flow's settings whole, so every
 * other value is sent as it was read here, never as the page sent it; and the
 * setting changed is one the flow's pinned version declares (the page's
 * `field`, else its only one), never another key the page names.
 */
export async function saveVendorChoice(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const choice = String(formData.get("choice") ?? "");
  const fieldKey = String(formData.get("field") ?? "");
  if (!subscriptionId || !choice) return { ok: false, error: SAVE_REFUSED };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    const { subscriptions } = await listSubscriptions(workspaceId);
    const subscription = subscriptions.find(
      (candidate) => candidate.id === subscriptionId,
    );
    const fields = (subscription?.setup ?? []).filter(
      (candidate) => candidate.control === "connection",
    );
    const field = fieldKey
      ? fields.find((candidate) => candidate.key === fieldKey)
      : fields[0];
    if (!subscription || !field) return { ok: false, error: SAVE_REFUSED };
    const body: UpdateSubscriptionRequest = {
      config: { ...subscription.config, [field.key]: choice },
    };
    return await saveConfig(formData, subscriptionId, body);
  } catch (error) {
    if (error instanceof PlatformServerError)
      return { ok: false, error: SAVE_REFUSED };
    throw error;
  }
}

/**
 * The email page's save (Build 22, P5; spec §4; the session's S30): the flow's
 * extra addresses, the whole list as the page sends it (`extra`, once each, in
 * order) — the platform replaces it whole, checks each address, and answers
 * who gets the email now, which the page then shows. Owner or admin only, as
 * the platform allows. Any refusal or failure says "Could not save. Try
 * again." and the page keeps its list; a workspace switched away in another
 * tab is said as it is everywhere.
 */
export async function saveEmailRecipients(
  formData: FormData,
): Promise<
  { ok: true; recipients: FlowEmailRecipients } | { ok: false; error: string }
> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const extra = formData.getAll("extra");
  if (!subscriptionId || extra.some((entry) => typeof entry !== "string"))
    return { ok: false, error: EMAIL_SAVE_FAILED };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    const recipients = await updateFlowEmailRecipients(
      workspaceId,
      subscriptionId,
      { extra: extra as string[] },
    );
    revalidatePath("/account/flows", "layout");
    return { ok: true, recipients };
  } catch (error) {
    if (error instanceof PlatformServerError)
      return { ok: false, error: EMAIL_SAVE_FAILED };
    throw error;
  }
}

const SAVE_REFUSED = "Could not save. Try again.";
const TURN_ON_REFUSED = "Could not turn it on. Try again.";

async function saveConfig(
  formData: FormData,
  subscriptionId: string,
  body: UpdateSubscriptionRequest,
): Promise<ActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await updateSubscription(
      workspaceId,
      subscriptionId,
      body,
      "subscription-config",
    );
    revalidatePath("/account/flows", "layout");
    return { ok: true };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 422 && error.details?.reason === "unmet_connections")
      return { ok: false, error: SAVE_REFUSED, state: "vendor-not-connected" };
    // A member's change, refused (Build 23's B3): the platform's 403 names
    // only its reason (the Edge's title is "Forbidden"), so it is said in the
    // clients' own words, the same as the member's note. Any other 403 is
    // the plain refusal.
    if (
      error.status === 403 &&
      error.details?.reason === "integration_requires_admin"
    )
      return { ok: false, error: VENDOR_MEMBER_NOTE, state: "forbidden" };
    return { ok: false, error: SAVE_REFUSED };
  }
}

/** A flow whose declaration changed under the page: it names items now, or no longer. */
const FLOW_CHANGED = "This flow has changed. Reload the page.";

/**
 * The refusals a run can meet that name their reason (backend FR-14), in
 * words. A file already given to a run, or gone, cannot be fixed by checking
 * the values: its field is emptied to choose the file again. A run that names
 * an item (backend ADR-0046) is refused for the item's sake — still being
 * read, or archived (409) — or because the flow's items changed under the
 * page (422); those words name no flow's things.
 */
const RUN_REFUSALS: Record<string, string> = {
  artifact_unavailable: "That file can no longer be used. Choose it again.",
  item_not_ready: "It is still being read. Try again in a moment.",
  item_archived: "It was archived, so it takes no new runs.",
  item_required: FLOW_CHANGED,
  items_not_declared: FLOW_CHANGED,
};

/** A change only an owner or admin may make, refused (`details.requiredRole`). */
const OWNERS_AND_ADMINS = "Only an owner or admin can do this.";

/**
 * A run refused because its flow is at capacity AND its queue is full (backend
 * BUILD-PLAN 25.2.10): a flow at capacity holds a new run back, `pending`, until
 * a run of it ends, and only once as many wait as it runs at once is a start
 * refused — 429, `details.reason` `max_concurrent_runs`. Nothing was created,
 * and only a run of this flow ending makes room, so it is said as the flow's
 * and not as the platform's "busy right now". Every other 429 keeps the
 * platform's words and the wait it stated.
 */
const FLOW_QUEUE_FULL =
  "This flow is busy and its queue is full, so the run was not started. Try again once one of its runs has ended.";

/**
 * Start a run of a manual automation — backend §12.1 #162, ADR-0030.
 *
 * The input is exactly what the subscription's pinned version declares; the
 * platform refuses anything else with 422 and runs nothing, so a refusal here is
 * worded as "check the values" rather than as a failure of the platform.
 *
 * **The idempotency key comes from the form**, made when the dialog opens and
 * again whenever a value changes. A resubmission of the same values after an
 * answer was lost therefore carries the same key, and the platform returns the
 * run it already started instead of starting a second one.
 *
 * **Nothing is asked before a run's file goes to an AI** (the owner's D1 of
 * 2026-10-15: "we dont need to say this at all … the terms and privacy policy
 * includes that information"): a run starts at the press of Start run, in
 * Step 1 of its flow's page.
 */
export async function startRun(formData: FormData): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!/^[A-Za-z0-9._~:-]{16,128}$/u.test(idempotencyKey)) {
    return { ok: false, error: "Reopen the form and try again." };
  }

  // The item a run of a flow with items names (backend ADR-0046); the
  // platform refuses one on a flow without, so none is sent there.
  const itemId = String(formData.get("itemId") ?? "");
  const body: CreateRunRequest = {
    subscriptionId,
    input: declaredValues(formData, "input"),
    ...(itemId ? { itemId } : {}),
  };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    const response = await createRun(workspaceId, body, idempotencyKey);
    revalidatePath("/account/runs");
    if (itemId)
      revalidatePath(
        `/account/flows/${encodeURIComponent(subscriptionId)}/items/${encodeURIComponent(itemId)}`,
      );
    return { ok: true, runId: response.run.id };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    const reason = error.details?.reason;
    const known =
      typeof reason === "string" && Object.hasOwn(RUN_REFUSALS, reason)
        ? RUN_REFUSALS[reason]
        : undefined;
    if (error.status === 422 && known) {
      return {
        ok: false,
        error: known,
        ...(reason === "artifact_unavailable"
          ? { state: "file-unavailable" as const }
          : {}),
      };
    }
    if (error.status === 422) {
      return {
        ok: false,
        error: "The run was not started. Check each value and try again.",
      };
    }
    if (error.status === 409 && known) return { ok: false, error: known };
    if (error.status === 409) {
      return {
        ok: false,
        error: "This flow is not live, so it cannot run.",
      };
    }
    if (error.status === 403 && error.details?.requiredRole) {
      return { ok: false, error: OWNERS_AND_ADMINS, state: "forbidden" };
    }
    if (error.status === 429 && reason === "max_concurrent_runs") {
      return { ok: false, error: FLOW_QUEUE_FULL };
    }
    // Over the plan (the owner's build 13 decision 7a3): no flow starts a run
    // until the workspace archives down. The same two reasons as the subscribe
    // path's, and only on a 403; every other 403 is authorization.
    const entitlement = subscriptionEntitlementState(
      error.status,
      error.details,
    );
    if (entitlement === "plan-limit") {
      return {
        ok: false,
        error: overPlanRefusal(error.details),
        state: "plan-limit",
      };
    }
    if (entitlement === "entitlements-unavailable") {
      return {
        ok: false,
        error:
          "Runs are unavailable while billing entitlements are not configured.",
        state: "entitlements-unavailable",
      };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Archive a subscription — backend §12.1 #92 and #169. ONE-WAY by the platform's
 * rule: it gives the plan slot back, and using the automation again means adding
 * it afresh — what the page calls unarchiving it (the owner, build 12's #4).
 * Its own action, rather than a status the generic one accepts, so the
 * irreversible transition is only ever reached through its confirmation.
 */
export async function archiveSubscription(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };

  const body: UpdateSubscriptionRequest = { status: "archived" };
  const result = await attempt(formData, (workspaceId) =>
    updateSubscription(workspaceId, subscriptionId, body, "archive"),
  );
  if (result.ok) {
    revalidatePath("/account/flows", "layout");
    revalidatePath("/account/billing");
  }
  return result;
}

export async function setSubscriptionStatus(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "live" && status !== "paused" && status !== "draft") {
    return { ok: false, error: "Unsupported status" };
  }

  const body: UpdateSubscriptionRequest = { status };
  const result = await attempt(formData, (workspaceId) =>
    updateSubscription(workspaceId, subscriptionId, body, "status"),
  );
  if (result.ok) revalidatePath("/account/flows", "layout");
  return result;
}

export async function decideApproval(
  formData: FormData,
): Promise<ActionResult> {
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, error: "Unsupported decision" };
  }

  const body: DecideApprovalRequest = { decision };
  // The job the decision answers, by the platform's own word: its run page is
  // drawn again too, where step 4 offered the decision (Build 24, P6). The
  // approval names the job's id (backend ADR-0044).
  let runId: string | undefined;
  const result = await attempt(formData, async (workspaceId) => {
    runId = (await decideWorkspaceApproval(workspaceId, approvalId, body))
      .approval.runId;
  });
  if (result.ok) {
    revalidatePath("/account/approvals");
    revalidatePath("/account/runs");
    if (runId) revalidatePath(`/account/runs/${encodeURIComponent(runId)}`);
  }
  return result;
}

/**
 * Cancel a run that has not ended (`cancelRun`). The platform cancels only a
 * `pending` or `running` run and answers 404 for any other — already finished,
 * held for approval, or not this workspace's — so a 404 here is said as "it has
 * already stopped", the one thing a person on the run's page can act on.
 */
export async function cancelRun(formData: FormData): Promise<ActionResult> {
  const runId = String(formData.get("runId") ?? "");
  const shownWorkspaceId = shownWorkspace(formData);
  if (!runId) return { ok: false, error: "A run is required." };
  try {
    // The run the page showed, in the workspace it showed: after a switch in
    // another tab the same id would be looked up elsewhere, answer 404, and
    // read as "already stopped" while it runs on.
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await cancelWorkspaceRun(workspaceId, runId);
    revalidatePath(`/account/runs/${encodeURIComponent(runId)}`);
    revalidatePath("/account/runs");
    return { ok: true, runId };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 404) {
      return {
        ok: false,
        error: "This run has already stopped, so there is nothing to cancel.",
      };
    }
    return { ok: false, error: error.message };
  }
}

/** What making an item came to: the item, or a refusal and the fields it names. */
export type ItemActionResult =
  | { ok: true; item: Item }
  | {
      ok: false;
      error: string;
      /** The fields the platform refused, by key: each says so under it. */
      fields?: string[];
      state?:
        | "file-unavailable"
        | "forbidden"
        | "plan-limit"
        | "entitlements-unavailable";
    };

/** An item the platform would not make, for a reason this page cannot fix. */
const ITEM_REFUSED = "It was not made. Try again.";

/**
 * Make an item from a file (backend ADR-0046, `createItem`; plan §5.2): the
 * values of its fields, chosen and typed on the upload card, and the file the
 * card already uploaded — and the platform starts the run that reads it.
 * Owner or admin only, as the platform allows.
 *
 * **The key is the card's**, made when it opens and again whenever a value
 * changes (as a run's is, `startRun`): a resubmission after a lost answer
 * reuses it, and the platform answers the same item rather than a second.
 * A refused field is named by its key (`details.problems`), so the card says
 * so under it; a file that can no longer be used empties the file field.
 */
export async function createItem(input: {
  /** The workspace the page showed. */
  workspaceId: string;
  subscriptionId: string;
  fields: Record<string, string>;
  /** The keys of the item's fields, which a refusal's problems are read against. */
  fieldKeys: string[];
  /** The uploaded file's artifact id. */
  file: string;
  idempotencyKey: string;
}): Promise<ItemActionResult> {
  if (!input.subscriptionId)
    return { ok: false, error: "A subscription is required." };
  if (!input.file) return { ok: false, error: "Choose the file first." };
  if (!/^[A-Za-z0-9._~:-]{16,128}$/u.test(input.idempotencyKey)) {
    return { ok: false, error: "Reopen the form and try again." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(input.workspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    const { item } = await createWorkspaceItem(
      workspaceId,
      input.subscriptionId,
      { fields: input.fields, file: input.file },
      input.idempotencyKey,
    );
    revalidatePath(
      `/account/flows/${encodeURIComponent(input.subscriptionId)}`,
    );
    return { ok: true, item };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    const reason = error.details?.reason;
    if (error.status === 422 && reason === "artifact_unavailable") {
      return {
        ok: false,
        error: RUN_REFUSALS.artifact_unavailable,
        state: "file-unavailable",
      };
    }
    if (error.status === 422) {
      const fields = problemFields(
        error.details?.problems,
        input.fieldKeys.map((key) => ({ key })),
      );
      return {
        ok: false,
        error: "It was not made. Check each value and try again.",
        ...(fields.length > 0 ? { fields } : {}),
      };
    }
    if (error.status === 409 && reason === "subscription_not_live") {
      return {
        ok: false,
        error: uploadRefusalMessage(reason) ?? ITEM_REFUSED,
      };
    }
    if (error.status === 409) return { ok: false, error: FLOW_CHANGED };
    const entitlement = subscriptionEntitlementState(
      error.status,
      error.details,
    );
    if (entitlement === "plan-limit") {
      return {
        ok: false,
        error: overPlanRefusal(error.details),
        state: "plan-limit",
      };
    }
    if (entitlement === "entitlements-unavailable") {
      return {
        ok: false,
        error:
          "Runs are unavailable while billing entitlements are not configured.",
        state: "entitlements-unavailable",
      };
    }
    if (error.status === 403) {
      return { ok: false, error: OWNERS_AND_ADMINS, state: "forbidden" };
    }
    return { ok: false, error: error.message || ITEM_REFUSED };
  }
}

/**
 * Archive an item (backend ADR-0046, `archiveItem`): one-way — it leaves its
 * flow's list and takes no new run; its runs and their results stay. Owner or
 * admin only, behind the page's confirmation.
 */
export async function archiveItem(formData: FormData): Promise<ActionResult> {
  const itemId = String(formData.get("itemId") ?? "");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!itemId || !subscriptionId)
    return { ok: false, error: "An item is required." };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await archiveWorkspaceItem(workspaceId, itemId);
    revalidatePath(
      `/account/flows/${encodeURIComponent(subscriptionId)}`,
      "layout",
    );
    return { ok: true, subscriptionId };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 403)
      return { ok: false, error: OWNERS_AND_ADMINS, state: "forbidden" };
    return { ok: false, error: error.message };
  }
}
