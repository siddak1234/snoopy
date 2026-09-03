"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import {
  newIdempotencyKey,
  platformServerJson,
  PlatformServerError,
} from "@/lib/platform-server";
import type {
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  CreateRunRequest,
  CreateRunResponse,
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
 * The workspace is resolved from the session here rather than accepted from the
 * form. The Edge would refuse a workspace the session does not name anyway, but
 * a form field that cannot influence the outcome is worth not having: it reads
 * as though it could.
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
async function attempt(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
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

  const workspaceId = await activeWorkspaceId();
  const body: CreateSubscriptionRequest = { templateId };
  try {
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
export async function saveSubscriptionConfiguration(
  formData: FormData,
): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required." };

  const config: Record<string, string | number | boolean> = {};
  for (const [name, control] of formData.entries()) {
    if (!name.startsWith("config-control:") || typeof control !== "string")
      continue;

    const key = name.slice("config-control:".length);
    const value = formData.get(`config:${key}`);
    if (control === "toggle") {
      config[key] = value === "true";
      continue;
    }
    if (typeof value !== "string" || value.trim() === "") continue;
    config[key] = control === "money" ? Number(value) : value;
  }

  const workspaceId = await activeWorkspaceId();
  const body: UpdateSubscriptionRequest = { config };
  const result = await attempt(() =>
    platformServerJson<UpdateSubscriptionResponse>(
      `/v1/workspaces/${workspaceId}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("subscription-config"),
      },
    ),
  );
  revalidatePath("/account/automations");
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

  const workspaceId = await activeWorkspaceId();
  const body: UpdateSubscriptionRequest = { status };
  const result = await attempt(() =>
    platformServerJson<UpdateSubscriptionResponse>(
      `/v1/workspaces/${workspaceId}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("status"),
      },
    ),
  );
  revalidatePath("/account/automations");
  return result;
}

export async function triggerRun(formData: FormData): Promise<ActionResult> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId)
    return { ok: false, error: "A subscription is required" };

  // The trigger payload is opaque to the platform (CreateRunRequest.input is a
  // free-form object) and the manifest publishes no input schema, so the UI
  // must not hardcode any one automation's fields. The person supplies the
  // input as JSON; an empty object is the default and a valid payload.
  const rawInput = formData.get("input");
  let input: Record<string, unknown> = {};
  if (typeof rawInput === "string" && rawInput.trim() !== "") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      return { ok: false, error: "Run input must be valid JSON." };
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return { ok: false, error: "Run input must be a JSON object." };
    }
    input = parsed as Record<string, unknown>;
  }

  const workspaceId = await activeWorkspaceId();
  const body: CreateRunRequest = { subscriptionId, input };
  try {
    const response = await platformServerJson<CreateRunResponse>(
      `/v1/workspaces/${workspaceId}/runs`,
      {
        method: "POST",
        body: JSON.stringify(body),
        idempotencyKey: newIdempotencyKey("run"),
      },
    );
    revalidatePath("/account/runs");
    revalidatePath("/account/automations");
    return { ok: true, runId: response.run.id };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function decideApproval(
  formData: FormData,
): Promise<ActionResult> {
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, error: "Unsupported decision" };
  }

  const workspaceId = await activeWorkspaceId();
  const body: DecideApprovalRequest = { decision };
  const result = await attempt(() =>
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
  revalidatePath("/account/approvals");
  revalidatePath("/account/runs");
  return result;
}
