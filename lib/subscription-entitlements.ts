export type SubscriptionEntitlementState =
  "plan-limit" | "entitlements-unavailable";

/**
 * The public subscription operation is the only API surface that allowlists
 * these entitlement reasons. Unknown values and all other statuses are not
 * product-state signals and must stay generic authorization failures.
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
