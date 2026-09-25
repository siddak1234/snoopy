import {
  platformServerJson,
  PlatformNotConfiguredError,
  PlatformServerError,
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

function scope(workspaceId: string): string {
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function listPlans(): Promise<PlanListResponse> {
  return platformServerJson("/v1/plans");
}

export function readWorkspaceBilling(
  workspaceId: string,
): Promise<WorkspaceBillingResponse> {
  return platformServerJson(`${scope(workspaceId)}/billing`);
}

/**
 * Billing is unavailable in two honest ways: the site has no backend configured,
 * or the platform has no billing provider configured and answers 503 —
 * `NotConfigured` on every billing operation, which is what production does
 * until a provider key exists. Both render as "unavailable", never as a false
 * plan. Anything else is rethrown: a broken platform must not look like one
 * that simply has no billing yet.
 */
export async function billingWhenUnavailable<T>(
  read: () => Promise<T>,
): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) return null;
    if (error instanceof PlatformServerError && error.status === 503) {
      return null;
    }
    throw error;
  }
}
