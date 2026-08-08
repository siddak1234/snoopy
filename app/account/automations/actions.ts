"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import {
  newIdempotencyKey,
  platformServerJson,
  PlatformServerError,
} from "@/lib/platform-server";
import type { Subscription } from "@/lib/automations";

/**
 * Mutations on the automation surface.
 *
 * The workspace is resolved from the session here rather than accepted from the
 * form. The Edge would refuse a workspace the session does not name anyway, but
 * a form field that cannot influence the outcome is worth not having: it reads
 * as though it could.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

async function activeWorkspaceId(): Promise<string> {
  const session = await getAppSession();
  const workspaceId = session?.user.workspaceId ?? session?.workspaces[0]?.id;
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

export async function subscribeToAutomation(
  formData: FormData,
): Promise<ActionResult> {
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { ok: false, error: "An automation is required" };

  const workspaceId = await activeWorkspaceId();
  const result = await attempt(() =>
    platformServerJson<{ subscription: Subscription }>(
      `/v1/workspaces/${workspaceId}/subscriptions`,
      {
        method: "POST",
        body: JSON.stringify({ templateId }),
        idempotencyKey: newIdempotencyKey("subscribe"),
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
  const result = await attempt(() =>
    platformServerJson<{ subscription: Subscription }>(
      `/v1/workspaces/${workspaceId}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
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

  const workspaceId = await activeWorkspaceId();
  const result = await attempt(() =>
    platformServerJson(`/v1/workspaces/${workspaceId}/runs`, {
      method: "POST",
      // No input: this automation's trigger is manual and its payload comes from
      // the run form on the subscription page, not from the catalog.
      body: JSON.stringify({ subscriptionId, input: {} }),
      idempotencyKey: newIdempotencyKey("run"),
    }),
  );
  revalidatePath("/account/runs");
  revalidatePath("/account/automations");
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

  const workspaceId = await activeWorkspaceId();
  const result = await attempt(() =>
    platformServerJson(
      `/v1/workspaces/${workspaceId}/approvals/${approvalId}/decision`,
      {
        method: "POST",
        // Only the decision. The actor and their role come from the session —
        // sending actorRole is refused as an unsupported field.
        body: JSON.stringify({ decision }),
        idempotencyKey: newIdempotencyKey("decision"),
      },
    ),
  );
  revalidatePath("/account/approvals");
  revalidatePath("/account/runs");
  return result;
}
