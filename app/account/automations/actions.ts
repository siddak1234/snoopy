"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import {
  newIdempotencyKey,
  platformServerJson,
  PlatformServerError,
} from "@/lib/platform-server";
import type {
  CreateRunRequest,
  CreateRunResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  DecideApprovalRequest,
  DecideApprovalResponse,
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse,
} from "@/lib/automations";
import { subscriptionEntitlementState } from "@/lib/subscription-entitlements";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * Mutations on the automation surface.
 *
 * **A path is revalidated only when the mutation succeeded.** Revalidating after a
 * refusal re-renders the page, and under a platform that is refusing requests
 * (backend §12.1 #160) that re-render is the "busy" panel — replacing the dialog,
 * its refusal and what the person typed. A refusal changed nothing to re-read.
 *
 * The workspace is resolved from the session here rather than accepted from the
 * form. The Edge would refuse a workspace the session does not name anyway, but
 * a form field that cannot influence the outcome is worth not having: it reads
 * as though it could.
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
      state?: "plan-limit" | "entitlements-unavailable";
    };

async function activeWorkspaceId(): Promise<string> {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) throw new PlatformServerError("No active workspace", 401);
  return workspaceId;
}

/** Turns a refusal into something renderable, and lets the unexpected surface. */
async function attempt(
  run: (workspaceId: string) => Promise<unknown>,
): Promise<ActionResult> {
  try {
    await run(await activeWorkspaceId());
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

export async function subscribeToAutomation(
  formData: FormData,
): Promise<ActionResult> {
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { ok: false, error: "An automation is required" };

  const body: CreateSubscriptionRequest = { templateId };
  try {
    const workspaceId = await activeWorkspaceId();
    const response = await platformServerJson<CreateSubscriptionResponse>(
      `/v1/workspaces/${workspaceId}/subscriptions`,
      {
        method: "POST",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("subscribe"),
      },
    );
    revalidatePath("/account/automations");
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
  const result = await attempt((workspaceId) =>
    platformServerJson<UpdateSubscriptionResponse>(
      `/v1/workspaces/${workspaceId}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("subscription-config"),
      },
    ),
  );
  if (result.ok) revalidatePath("/account/automations");
  return result;
}

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
    const workspaceId = await activeWorkspaceId();
    const response = await platformServerJson<CreateRunResponse>(
      `/v1/workspaces/${workspaceId}/runs`,
      {
        method: "POST",
        body: JSON.stringify(body),
        idempotencyKey,
      },
    );
    revalidatePath("/account/runs");
    return { ok: true, runId: response.run.id };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 422) {
      return {
        ok: false,
        error: "The run was not started. Check each value and try again.",
      };
    }
    if (error.status === 409) {
      return {
        ok: false,
        error: "This automation is not live, so it cannot run.",
      };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Archive a subscription — backend §12.1 #92 and #169. ONE-WAY by the platform's
 * rule: it gives the plan slot back, and using the automation again means adding
 * it afresh. Its own action, rather than a status the generic one accepts, so the
 * irreversible transition is only ever reached through its confirmation.
 */
export async function archiveSubscription(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };

  const body: UpdateSubscriptionRequest = { status: "archived" };
  const result = await attempt((workspaceId) =>
    platformServerJson<UpdateSubscriptionResponse>(
      `/v1/workspaces/${workspaceId}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("archive"),
      },
    ),
  );
  if (result.ok) {
    revalidatePath("/account/automations");
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
  const result = await attempt((workspaceId) =>
    platformServerJson<UpdateSubscriptionResponse>(
      `/v1/workspaces/${workspaceId}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("status"),
      },
    ),
  );
  if (result.ok) revalidatePath("/account/automations");
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
  const result = await attempt((workspaceId) =>
    platformServerJson<DecideApprovalResponse>(
      `/v1/workspaces/${workspaceId}/approvals/${approvalId}/decision`,
      {
        method: "POST",
        // Only the decision. The actor and their role come from the session —
        // sending actorRole is refused as an unsupported field.
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("decision"),
      },
    ),
  );
  if (result.ok) {
    revalidatePath("/account/approvals");
    revalidatePath("/account/runs");
  }
  return result;
}
