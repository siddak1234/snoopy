"use server";

import { revalidatePath } from "next/cache";
import { PlatformServerError } from "@/lib/platform-server";
import {
  cancelRun as cancelWorkspaceRun,
  createRun,
  createSubscription,
  decideApproval as decideWorkspaceApproval,
  listSubscriptions,
  updateSubscription,
  type CreateRunRequest,
  type CreateSubscriptionRequest,
  type DecideApprovalRequest,
  type UpdateSubscriptionRequest,
} from "@/lib/automations";
import { heldCopy } from "@/lib/held-flow";
import { overPlanRefusal } from "@/lib/plan-limit";
import { subscriptionEntitlementState } from "@/lib/subscription-entitlements";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";

/**
 * Mutations on the automation surface.
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
      state?: "plan-limit" | "entitlements-unavailable" | "file-unavailable";
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

export async function subscribeToAutomation(
  formData: FormData,
): Promise<ActionResult> {
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { ok: false, error: "A flow is required" };
  // A flow is added to a team (the owner, build 10): the team is named every
  // time, in the shared wording's words when it is not, and the platform
  // checks the person can see it (18.6.2) — one they cannot is 404, not a
  // hint. The whole workspace, which the platform would still accept, is
  // never sent.
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { ok: false, error: "Pick a team." };

  const body: CreateSubscriptionRequest = { templateId, projectId };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    // A workspace holds each flow once (the owner, build 12's #9). The
    // platform still takes one per team (backend 18.6.2) until its own guard
    // lands, so a page drawn before another tab or person added the flow is
    // refused here, in words, and nothing is sent. Only what this person may
    // see is listed: a copy in a team hidden from them is the platform's to
    // refuse.
    const { subscriptions } = await listSubscriptions(workspaceId);
    if (heldCopy(subscriptions, templateId))
      return { ok: false, error: ALREADY_IN_WORKSPACE };
    const response = await createSubscription(workspaceId, body);
    revalidatePath("/account/flows");
    return { ok: true, subscriptionId: response.subscription.id };
  } catch (error) {
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

export async function saveSubscriptionConfiguration(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };

  const config = declaredValues(formData, "config");

  const body: UpdateSubscriptionRequest = { config };
  const result = await attempt(formData, (workspaceId) =>
    updateSubscription(
      workspaceId,
      subscriptionId,
      body,
      "subscription-config",
    ),
  );
  if (result.ok) revalidatePath("/account/flows");
  return result;
}

/**
 * The refusals a run can meet that name their reason (backend FR-14), in
 * words. A file already given to a run, or gone, cannot be fixed by checking
 * the values: its field is emptied to choose the file again.
 */
const RUN_REFUSALS: Record<string, string> = {
  artifact_unavailable: "That file can no longer be used. Choose it again.",
};

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
 */
export async function startRun(formData: FormData): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!/^[A-Za-z0-9._~:-]{16,128}$/u.test(idempotencyKey)) {
    return { ok: false, error: "Reopen the form and try again." };
  }

  const body: CreateRunRequest = {
    subscriptionId,
    input: declaredValues(formData, "input"),
  };
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    const response = await createRun(workspaceId, body, idempotencyKey);
    revalidatePath("/account/runs");
    return { ok: true, runId: response.run.id };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    const reason = error.details?.reason;
    const known = typeof reason === "string" ? RUN_REFUSALS[reason] : undefined;
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
    if (error.status === 409) {
      return {
        ok: false,
        error: "This flow is not live, so it cannot run.",
      };
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
    revalidatePath("/account/flows");
    revalidatePath("/account/billing");
  }
  return result;
}

/**
 * The refusals a move can meet that a person can act on (backend §12.1 #126),
 * in words. Anything else is the platform's own message.
 */
const MOVE_REFUSALS: Record<string, string> = {
  approvals_pending:
    "An approval for this flow is still waiting. Decide it first, then move.",
  runs_in_flight:
    "A run of this flow is still going. Wait for it to finish, then move.",
  version_unavailable: "That version is no longer available.",
  subscription_archived: "An archived flow cannot move.",
  invalid_config:
    "Its settings do not fit that version. Open Set up, fix them, then move.",
  unmet_connections:
    "That version needs an account this workspace has not connected. Connect it first, or pause the flow and move.",
  setup_incomplete:
    "That version needs a setting this flow does not have yet. Pause it, move, then finish Set up.",
};

/** Moves a subscription to another version of its automation (backend §12.1 #126). */
export async function moveSubscriptionVersion(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const templateVersion = Number(formData.get("templateVersion"));
  if (
    !subscriptionId ||
    !Number.isInteger(templateVersion) ||
    templateVersion < 1
  ) {
    return { ok: false, error: "Choose a version to move to." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspace(formData));
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await updateSubscription(
      workspaceId,
      subscriptionId,
      { templateVersion },
      "version",
    );
    revalidatePath("/account/flows");
    return { ok: true };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    const reason = error.details?.reason;
    const known =
      typeof reason === "string" ? MOVE_REFUSALS[reason] : undefined;
    return { ok: false, error: known ?? error.message };
  }
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
  if (result.ok) revalidatePath("/account/flows");
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
  const result = await attempt(formData, (workspaceId) =>
    decideWorkspaceApproval(workspaceId, approvalId, body),
  );
  if (result.ok) {
    revalidatePath("/account/approvals");
    revalidatePath("/account/runs");
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
