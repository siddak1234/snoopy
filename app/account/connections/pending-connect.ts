/**
 * What this tab keeps while the browser is at a vendor's consent page — the
 * platform's callback carries only `status` (`app/connections/page.tsx`), so
 * the page it returns to cannot otherwise tell which vendor the connect was
 * for, or where it was started. A provider id and a path only, in this tab's
 * storage — never a credential.
 *
 * - Which provider the last Connect, Reconnect or Replace left for, so the
 *   page a connect returns to can say whether THAT provider's connection is
 *   active (register F100), and a flow's vendor page can make it the choice.
 * - Where a connect started on a flow's vendor page (spec §3.C): the callback
 *   lands on Connections, which goes back there.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

export const PENDING_CONNECT = "autom8x.connections.pending";

/** Where a connect started on a flow's vendor page; a path only. */
export const CONNECT_RETURN = "autom8x.connections.return";

// A flow id is a UUID, so only a path of exactly a vendor page's shape
// (`app/account/flows/vendor-path.ts`) is ever navigated to from what this tab
// kept — never another page of this site, and never another site.
const VENDOR_PATH =
  /^\/account\/flows\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/vendor$/u;

/** Whether a kept value is a flow's vendor page path, and nothing else. */
export function isVendorPath(value: unknown): value is string {
  return typeof value === "string" && VENDOR_PATH.test(value);
}

/**
 * Kept as the browser leaves for the vendor; storage refused (a private
 * window, a policy) keeps nothing, and the page then says only what is always
 * true. A connect started on Connections keeps no way back.
 */
export function rememberConnect(providerId: string, returnTo?: string) {
  try {
    sessionStorage.setItem(PENDING_CONNECT, providerId);
    if (returnTo && isVendorPath(returnTo)) {
      sessionStorage.setItem(CONNECT_RETURN, returnTo);
    } else {
      sessionStorage.removeItem(CONNECT_RETURN);
    }
  } catch {
    // Nothing kept: see above.
  }
}

/**
 * The vendor page a connect started on, taken once — read and removed — and
 * only when it is exactly such a page's path; null otherwise.
 */
export function takeConnectReturn(): string | null {
  try {
    const kept = sessionStorage.getItem(CONNECT_RETURN);
    sessionStorage.removeItem(CONNECT_RETURN);
    return isVendorPath(kept) ? kept : null;
  } catch {
    return null;
  }
}
