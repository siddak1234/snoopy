import { beginConnectionAuthorization, type EhrSignIn } from "./actions";
import { rememberConnect } from "./pending-connect";

/** How a connect started from a row ended, as far as its page sees it. */
export type ConnectStart =
  | { status: "already"; connectedAs: string }
  | { status: "refused"; message: string; replaceable?: boolean }
  | { status: "left" };

/**
 * A connect started from a row, written once for Connections' Connect and
 * Reconnect, for a flow step's vendor rows (Build 25, the review's R5c 5;
 * the app's `connectOAuthProvider`) and for an EHR sign-in's form (`signIn`,
 * its vendor and FHIR address; backend ADR-0054). The platform is asked to
 * begin. A grant it reuses says as whom, and the page stays. A refusal, or
 * an answer with no consent page, comes back in words — an EHR sign-in over
 * another address `replaceable`. Otherwise this tab keeps which provider and
 * where to come back (`rememberConnect`), and the browser goes to the
 * vendor's consent page, or the EHR's sign-in page.
 */
export async function startConnect(
  workspaceId: string,
  providerId: string,
  returnTo?: string,
  signIn?: EhrSignIn,
): Promise<ConnectStart> {
  const result = await beginConnectionAuthorization(
    workspaceId,
    providerId,
    signIn,
  );
  if (result.ok && result.alreadyConnectedAs)
    return { status: "already", connectedAs: result.alreadyConnectedAs };
  if (!result.ok || !result.authorizationUrl) {
    return {
      status: "refused",
      message: result.ok ? "Could not start the connection" : result.error,
      ...(!result.ok && result.replaceable ? { replaceable: true } : {}),
    };
  }
  rememberConnect(providerId, returnTo);
  window.location.assign(result.authorizationUrl);
  return { status: "left" };
}
