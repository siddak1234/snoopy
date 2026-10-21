import { beginConnectionAuthorization } from "./actions";
import { rememberConnect } from "./pending-connect";

/** How a connect started from a row ended, as far as its page sees it. */
export type ConnectStart =
  | { status: "already"; connectedAs: string }
  | { status: "refused"; message: string }
  | { status: "left" };

/**
 * A connect started from a row, written once for Connections' Connect and
 * Reconnect and for a flow step's vendor rows (Build 25, the review's R5c 5;
 * the app's `connectOAuthProvider`). The platform is asked to begin. A grant
 * it reuses says as whom, and the page stays. A refusal, or an answer with no
 * consent page, comes back in words. Otherwise this tab keeps which provider
 * and where to come back (`rememberConnect`), and the browser goes to the
 * vendor's consent page.
 */
export async function startConnect(
  workspaceId: string,
  providerId: string,
  returnTo?: string,
): Promise<ConnectStart> {
  const result = await beginConnectionAuthorization(workspaceId, providerId);
  if (result.ok && result.alreadyConnectedAs)
    return { status: "already", connectedAs: result.alreadyConnectedAs };
  if (!result.ok || !result.authorizationUrl) {
    return {
      status: "refused",
      message: result.ok ? "Could not start the connection" : result.error,
    };
  }
  rememberConnect(providerId, returnTo);
  window.location.assign(result.authorizationUrl);
  return { status: "left" };
}
