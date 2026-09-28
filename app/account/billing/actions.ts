"use server";

import {
  createBillingCheckout,
  createBillingPortal,
  type BillingCheckoutRequest,
  type HostedBillingSession,
} from "@/lib/billing";
import { PlatformServerError } from "@/lib/platform-server";
import { requireActiveWorkspaceId } from "@/lib/tenancy";

/**
 * Checkout and the portal are provider-hosted (ADR-0025): the platform answers
 * a URL and the browser navigates there. Nothing about a card, a customer or a
 * price passes through here, and the server enforces owner or admin again on
 * every call — the page's role gate only avoids offering a button that is
 * certain to be refused.
 */
export type BillingActionResult =
  | { ok: true; url: string }
  | { ok: false; error: string; needsCheckout?: boolean };

// The active workspace can change in another tab after the page rendered. A
// purchase or a portal session must be for the workspace the person was looking
// at, so the page sends that id and the action refuses when the session's active
// workspace is no longer it. The id is only compared: the path always uses the
// workspace the server resolves, never one the browser names.
const WORKSPACE_CHANGED =
  "The active workspace changed in another tab. Reload this page before continuing.";

// A hosted session is a capability, not a credential, and it is only ever an
// https URL. Anything else is refused here rather than navigated to.
function hosted(session: HostedBillingSession): BillingActionResult {
  let url: URL;
  try {
    url = new URL(session.url);
  } catch {
    return {
      ok: false,
      error: "The billing service answered an unusable address.",
    };
  }
  if (url.protocol !== "https:") {
    return {
      ok: false,
      error: "The billing service answered an unusable address.",
    };
  }
  return { ok: true, url: url.href };
}

function failure(error: unknown): BillingActionResult {
  if (error instanceof PlatformServerError) {
    return { ok: false, error: error.message };
  }
  throw error;
}

export async function beginBillingCheckout(
  shownWorkspaceId: string,
  planId: string,
): Promise<BillingActionResult> {
  if (!planId) return { ok: false, error: "A plan is required" };
  try {
    const workspaceId = await requireActiveWorkspaceId();
    if (workspaceId !== shownWorkspaceId) {
      return { ok: false, error: WORKSPACE_CHANGED };
    }
    // No successUrl or cancelUrl: the platform defaults to the deployment's own
    // configured return URL and refuses any other origin.
    const body: BillingCheckoutRequest = { planId };
    return hosted(await createBillingCheckout(workspaceId, body));
  } catch (error) {
    return failure(error);
  }
}

export async function openBillingPortal(
  shownWorkspaceId: string,
): Promise<BillingActionResult> {
  try {
    const workspaceId = await requireActiveWorkspaceId();
    if (workspaceId !== shownWorkspaceId) {
      return { ok: false, error: WORKSPACE_CHANGED };
    }
    // No returnUrl, for the same reason as above.
    return hosted(await createBillingPortal(workspaceId));
  } catch (error) {
    // The portal answers 409 when the workspace has no billing account yet: the
    // client sends the person to checkout rather than showing a conflict. Only
    // the portal documents that 409, so the rule lives here and nowhere else —
    // a conflict from any other call is shown as what it is.
    if (error instanceof PlatformServerError && error.status === 409) {
      return { ok: false, error: error.message, needsCheckout: true };
    }
    return failure(error);
  }
}
