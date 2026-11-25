"use server";

import { revalidatePath } from "next/cache";
import {
  beginConnectionAuthorization as beginAuthorization,
  connectProviderWithKey as connectWithKey,
  disconnectConnection as disconnect,
  type ConnectionAuthorizationRequest,
  type ConnectProviderWithKeyRequest,
} from "@/lib/connections";
import { PlatformServerError } from "@/lib/platform-server";
import { ehrSignInRefusal, smartBackendRefusal } from "@/lib/smart-backend";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";

export type ConnectionActionResult =
  | { ok: true; authorizationUrl?: string; alreadyConnectedAs?: string }
  | {
      ok: false;
      error: string;
      retryWithSameIntent?: boolean;
      /** An EHR sign-in over another address: Replace begins it again (backend ADR-0054). */
      replaceable?: boolean;
    };

/**
 * An EHR sign-in's begin (backend ADR-0054): the vendor and the clinic's FHIR
 * address, as the sign-in form posts them, and — Replace, answering a 409
 * `account_mismatch` — the live connection it replaces.
 */
export type EhrSignIn = {
  credentials: Record<string, string>;
  replaceConnectionId?: string;
};

// Every action here acts on the workspace the page showed (register F28, F70):
// after a switch in another tab, Connect would otherwise authorize an account
// into a workspace the person was not looking at.
const workspaceChanged: ConnectionActionResult = {
  ok: false,
  error: WORKSPACE_CHANGED,
};

// A refusal in the platform's words — but a FHIR address the EHR's connect
// will not use (backend ADR-0050), said in the spec's, by its reason.
function failure(error: unknown): ConnectionActionResult {
  if (error instanceof PlatformServerError) {
    return {
      ok: false,
      error: smartBackendRefusal(error.status, error.details) ?? error.message,
      ...(error.status === 409 ? { retryWithSameIntent: true } : {}),
    };
  }
  throw error;
}

/**
 * Starts a connection — Connect, or Reconnect, which keeps the account
 * (backend ADR-0019 §4) — for an owner or admin. ~~Replace account, with the
 * exact id of the live connection (backend ADR-0026)~~ is off the row since
 * Build 21 (spec A4); the platform's route stays, unused.
 *
 * The platform answers one of two outcomes (backend §12.1 #172): a live grant
 * that already holds every permission the provider asks for is `reused`, and no
 * consent is asked for, so the person is told so rather than sent anywhere; any
 * other answer carries the provider's consent page. A connection that needs
 * reauthorization is never reused (backend §12.1 #175) — Reconnect repairs it.
 *
 * An EHR sign-in (`signIn`, backend ADR-0054) begins here too, its vendor and
 * FHIR address as `credentials`: the same two outcomes, and its refusals in
 * the spec's words (`ehrSignInRefusal`) — a 409 `account_mismatch` one that
 * Replace answers, naming the live connection.
 */
export async function beginConnectionAuthorization(
  shownWorkspaceId: string,
  providerId: string,
  signIn?: EhrSignIn,
): Promise<ConnectionActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return workspaceChanged;
    const credentials = signIn ? ehrCredentials(signIn.credentials) : null;
    if (signIn && !credentials)
      return { ok: false, error: "Complete every required credential field" };
    const body: ConnectionAuthorizationRequest = {
      providerId,
      ...(credentials ? { credentials } : {}),
      ...(signIn?.replaceConnectionId
        ? { replaceConnectionId: signIn.replaceConnectionId }
        : {}),
    };
    const result = await beginAuthorization(workspaceId, body);
    if (result.outcome === "reused") {
      revalidatePath("/account/connections");
      return {
        ok: true,
        alreadyConnectedAs: result.connection.externalAccount.displayName,
      };
    }
    return { ok: true, authorizationUrl: result.authorizationUrl };
  } catch (error) {
    const refused =
      signIn && error instanceof PlatformServerError
        ? ehrSignInRefusal(error.status, error.details)
        : null;
    if (refused)
      return {
        ok: false,
        error: refused.message,
        ...(refused.replaceable ? { replaceable: true } : {}),
      };
    return failure(error);
  }
}

/** The sign-in's two values, each trimmed and present; else `null`, and nothing is sent. */
function ehrCredentials(
  posted: Record<string, string>,
): { vendor: string; fhirBaseUrl: string } | null {
  const vendor = String(posted.vendor ?? "").trim();
  const fhirBaseUrl = String(posted.fhirBaseUrl ?? "").trim();
  return vendor && fhirBaseUrl ? { vendor, fhirBaseUrl } : null;
}

export async function connectProviderWithKey(
  formData: FormData,
): Promise<ConnectionActionResult> {
  const providerId = String(formData.get("providerId") ?? "");
  if (!providerId) return { ok: false, error: "A provider is required" };
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!/^[A-Za-z0-9._~:-]{16,128}$/u.test(idempotencyKey)) {
    return {
      ok: false,
      error: "The connection request could not be submitted.",
    };
  }

  const credentials: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("credential:")) continue;
    const field = key.slice("credential:".length);
    if (typeof value !== "string" || !value.trim()) {
      return { ok: false, error: "Complete every required credential field" };
    }
    credentials[field] = value.trim();
  }

  try {
    const workspaceId = await activeWorkspaceIfShown(
      String(formData.get("workspaceId") ?? ""),
    );
    if (!workspaceId) return workspaceChanged;
    const body: ConnectProviderWithKeyRequest = { providerId, credentials };
    await connectWithKey(workspaceId, body, idempotencyKey);
    revalidatePath("/account/connections");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectConnection(
  shownWorkspaceId: string,
  connectionId: string,
): Promise<ConnectionActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return workspaceChanged;
    await disconnect(workspaceId, connectionId);
    revalidatePath("/account/connections");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
