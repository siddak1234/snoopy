"use server";

import { PlatformServerError } from "@/lib/platform-server";
import {
  issueWebhookEndpoint,
  readWebhookEndpoint,
  type IssuedWebhookEndpoint,
  type WebhookEndpoint,
} from "@/lib/automations";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";

/**
 * A webhook automation's address (backend §12.1 #91, #109). Owner or admin —
 * the page offers it to no one else, and the platform refuses anyone else.
 *
 * The secret comes back from `issue` only, is handed to the page that asked,
 * and is never stored here: the dialog shows it once and forgets it.
 *
 * `issue` carries the dialog's idempotency key (backend §12.1 #240): a fresh
 * one per press, the same one on every retry of it, so a press after a lost
 * answer is answered with the secret that answer carried rather than a second
 * rotation. The key is checked here the way the Run form's is.
 *
 * Both act on the workspace the page showed (`activeWorkspaceIfShown`, register
 * F28). After a switch in another tab the read would otherwise ask the other
 * workspace, whose 404 reads as "no address yet" for an automation that has one.
 */

export type WebhookReadResult =
  { ok: true; endpoint: WebhookEndpoint | null } | { ok: false; error: string };
export type WebhookIssueResult =
  { ok: true; issued: IssuedWebhookEndpoint } | { ok: false; error: string };

const ISSUE_REFUSALS: Record<string, string> = {
  trigger_kind_mismatch: "This flow is not started by a webhook.",
  subscription_archived: "An archived flow has no address.",
};

export async function readWebhookAddress(
  shownWorkspaceId: string,
  subscriptionId: string,
): Promise<WebhookReadResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    return {
      ok: true,
      endpoint: await readWebhookEndpoint(workspaceId, subscriptionId),
    };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    return { ok: false, error: error.message };
  }
}

export async function issueWebhookAddress(
  shownWorkspaceId: string,
  subscriptionId: string,
  idempotencyKey: string,
): Promise<WebhookIssueResult> {
  if (!/^[A-Za-z0-9._~:-]{16,128}$/u.test(idempotencyKey)) {
    return { ok: false, error: "Reload the page and try again." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    return {
      ok: true,
      issued: await issueWebhookEndpoint(
        workspaceId,
        subscriptionId,
        idempotencyKey,
      ),
    };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    const reason = error.details?.reason;
    const known =
      typeof reason === "string" ? ISSUE_REFUSALS[reason] : undefined;
    return { ok: false, error: known ?? error.message };
  }
}
