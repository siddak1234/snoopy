export type SubscriptionEntitlementState =
  "plan-limit" | "entitlements-unavailable";

/**
 * The public subscription operation and, since build 14, a run's start (the
 * owner's decision 7a3) are the API surfaces that allowlist these entitlement
 * reasons. Unknown values and all other statuses are not product-state signals
 * and must stay generic authorization failures.
 */
export function subscriptionEntitlementState(
  status: number,
  details: Record<string, unknown> | undefined,
): SubscriptionEntitlementState | null {
  if (status !== 403) return null;
  if (details?.reason === "over_plan_limit") return "plan-limit";
  if (details?.reason === "entitlements_not_configured") {
    return "entitlements-unavailable";
  }
  return null;
}

/**
 * Only an owner or admin changes a flow (backend §12.1 #180): a member's add,
 * set up, pause or resume, or archive is refused at the Edge with 403
 * `flow_change_requires_admin`. A member sees each of those controls
 * read-only, with this line; a refusal says it too.
 */
export const FLOW_CHANGE_ADMIN_ONLY =
  "Only an owner or admin can change this flow.";

/** Whether a refusal is a member's change of a flow (`flow_change_requires_admin`). */
export function flowChangeRefused(
  status: number,
  details: Record<string, unknown> | undefined,
): boolean {
  return status === 403 && details?.reason === "flow_change_requires_admin";
}
