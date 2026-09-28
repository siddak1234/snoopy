import {
  platformServerJson,
  PlatformServerError,
  workspacePath as scope,
} from "@/lib/platform-server";
import type {
  components,
  operations,
} from "./generated/platform-contracts/platform";

/**
 * Billing, as the website consumes it — ADR-0025's four read-or-redirect
 * operations and nothing else. The two reads live here; the two hosted
 * hand-offs are server actions in `app/account/billing/actions.ts`, as the
 * automations and connections surfaces keep theirs (tenancy keeps its writes in
 * its facade instead), typed by the aliases below.
 *
 * Checkout and the portal are provider-hosted: the platform answers a URL and
 * the browser navigates there, so no card field and no identifier that is not
 * this platform's own plan id ever passes through this code. Cancel, upgrade
 * and downgrade live in the portal by design; the platform publishes no
 * operation for them.
 */

export type PurchasablePlan = components["schemas"]["PurchasablePlan"];
export type PlanListResponse =
  operations["listPlans"]["responses"][200]["content"]["application/json"];
export type WorkspaceBillingResponse =
  operations["readWorkspaceBilling"]["responses"][200]["content"]["application/json"];
export type BillingCheckoutRequest =
  operations["createBillingCheckoutSession"]["requestBody"]["content"]["application/json"];
export type BillingPortalRequest = NonNullable<
  operations["createBillingPortalSession"]["requestBody"]
>["content"]["application/json"];
export type HostedBillingSession =
  operations["createBillingCheckoutSession"]["responses"][201]["content"]["application/json"];

export function listPlans(): Promise<PlanListResponse> {
  return platformServerJson("/v1/plans");
}

/** A hosted checkout for one plan — no success or cancel URL: the platform uses its own. */
export function createBillingCheckout(
  workspaceId: string,
  body: BillingCheckoutRequest,
): Promise<HostedBillingSession> {
  return platformServerJson<HostedBillingSession>(
    `${scope(workspaceId)}/billing/checkout`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/**
 * A hosted portal session. The contract marks the body optional and the Edge
 * accepts none since backend §12.1 #165; `{}` is still sent because an Edge
 * deployed before that fix answers 400 to an empty body, and `{}` is valid for
 * both.
 */
export function createBillingPortal(
  workspaceId: string,
): Promise<HostedBillingSession> {
  const body: BillingPortalRequest = {};
  return platformServerJson<HostedBillingSession>(
    `${scope(workspaceId)}/billing/portal`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function readWorkspaceBilling(
  workspaceId: string,
): Promise<WorkspaceBillingResponse> {
  return platformServerJson(`${scope(workspaceId)}/billing`);
}

/**
 * Billing is unavailable in one honest way: the platform has no billing provider
 * configured and answers 503 — `NotConfigured` on every billing operation, which
 * is what an estate does until a provider key exists. That renders as
 * "unavailable", never as a false plan. Anything else is rethrown: a broken
 * platform must not look like one that simply has no billing yet.
 *
 * A site with no backend configured never reaches here — the account layout
 * sends it to sign-in first — so it is not special-cased (register F32).
 */
export async function billingWhenUnavailable<T>(
  read: () => Promise<T>,
): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 503) {
      return null;
    }
    throw error;
  }
}
