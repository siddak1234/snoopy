/**
 * A flow's Connect vendor page (spec §3.C). A connect started there comes
 * back to it (`app/account/connections/pending-connect.ts`).
 */
export function vendorPath(subscriptionId: string): string {
  return `/account/flows/${encodeURIComponent(subscriptionId)}/vendor`;
}
