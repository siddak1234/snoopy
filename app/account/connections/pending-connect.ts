/**
 * What this tab keeps while the browser is at a vendor's consent page — the
 * platform's callback carries only `status` (`app/connections/page.tsx`), so
 * the page it returns to cannot otherwise tell which vendor the connect was
 * for, or where it was started. A provider id and a path only, in this tab's
 * storage — never a credential.
 *
 * - Which provider the last Connect or Reconnect left for, so the page a
 *   connect returns to can say whether THAT provider's connection is active
 *   (register F100), and a flow's vendor page or Set up can make it the choice.
 * - Where a connect started on a flow's own pages (Build 21, spec A2, A6; the
 *   owner's build 20 item 2: "If i need to connect then after i click and
 *   connection happens then it shoukd take me back"): the flow page, its Set
 *   up, or its Connect vendor page for one step's choice (`?field=`). The
 *   callback lands on Connections, which goes back there.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

export const PENDING_CONNECT = "autom8x.connections.pending";

/** Where a connect started on a flow's own page; a path only. */
export const CONNECT_RETURN = "autom8x.connections.return";

// A flow id is a UUID, and a setting's key the manifest's own pattern
// (`^[a-z][A-Za-z0-9]*$`, at most 64), so only a path of exactly one of these
// shapes is ever navigated to from what this tab kept — never another page of
// this site, and never another site.
const FLOW_PAGE =
  /^\/account\/flows\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/setup|\/vendor(?:\?field=[a-z][A-Za-z0-9]{0,63})?)?$/u;

/** Whether a kept value is a flow's page, its Set up or its vendor page path, and nothing else. */
export function isReturnPath(value: unknown): value is string {
  return typeof value === "string" && FLOW_PAGE.test(value);
}

/**
 * Kept as the browser leaves for the vendor; storage refused (a private
 * window, a policy) keeps nothing, and the page then says only what is always
 * true. A connect started on Connections keeps no way back.
 */
export function rememberConnect(providerId: string, returnTo?: string) {
  try {
    sessionStorage.setItem(PENDING_CONNECT, providerId);
    if (returnTo && isReturnPath(returnTo)) {
      sessionStorage.setItem(CONNECT_RETURN, returnTo);
    } else {
      sessionStorage.removeItem(CONNECT_RETURN);
    }
  } catch {
    // Nothing kept: see above.
  }
}

/**
 * The flow page a connect started on, taken once — read and removed — and
 * only when it is exactly such a page's path; null otherwise.
 */
export function takeConnectReturn(): string | null {
  try {
    const kept = sessionStorage.getItem(CONNECT_RETURN);
    sessionStorage.removeItem(CONNECT_RETURN);
    return isReturnPath(kept) ? kept : null;
  } catch {
    return null;
  }
}

/** That page again, saying how the sign-in ended (`connected` or `error`). */
export function withCallbackStatus(
  path: string,
  status: "connected" | "error",
): string {
  return `${path}${path.includes("?") ? "&" : "?"}status=${status}`;
}
