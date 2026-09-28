import {
  platformServerJson,
  PlatformNotConfiguredError,
  workspacePath as scope,
} from "@/lib/platform-server";
import type {
  components,
  operations,
} from "./generated/platform-contracts/connections";

export type ConnectionProvider = components["schemas"]["ConnectionProvider"];
export type ConnectionStatus = components["schemas"]["ConnectionStatus"];
export type Connection = components["schemas"]["Connection"];
export type ConnectionProvidersResponse =
  operations["listConnectionProviders"]["responses"][200]["content"]["application/json"];
export type ConnectionsResponse =
  operations["listConnections"]["responses"][200]["content"]["application/json"];
export type ConnectionAuthorizationResponse =
  operations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"];
export type ConnectProviderWithKeyRequest =
  operations["connectProviderWithKey"]["requestBody"]["content"]["application/json"];
export type ConnectProviderWithKeyResponse =
  operations["connectProviderWithKey"]["responses"][201]["content"]["application/json"];
export type DisconnectConnectionResponse =
  operations["disconnectConnection"]["responses"][200]["content"]["application/json"];
export type ConnectionAuthorizationRequest =
  operations["beginConnectionAuthorization"]["requestBody"]["content"]["application/json"];

export function listConnectionProviders(): Promise<ConnectionProvidersResponse> {
  return platformServerJson("/v1/connections/providers");
}

export function listConnections(
  workspaceId: string,
): Promise<ConnectionsResponse> {
  return platformServerJson(`${scope(workspaceId)}/connections`);
}

export function beginConnectionAuthorization(
  workspaceId: string,
  body: ConnectionAuthorizationRequest,
): Promise<ConnectionAuthorizationResponse> {
  return platformServerJson<ConnectionAuthorizationResponse>(
    `${scope(workspaceId)}/connections/authorize`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/**
 * The key is minted once in the browser when Connect is chosen, so a retry of the
 * same intent reuses it; it is deliberately not part of the JSON body.
 */
export function connectProviderWithKey(
  workspaceId: string,
  body: ConnectProviderWithKeyRequest,
  idempotencyKey: string,
): Promise<ConnectProviderWithKeyResponse> {
  return platformServerJson<ConnectProviderWithKeyResponse>(
    `${scope(workspaceId)}/connections/key`,
    { method: "POST", body: JSON.stringify(body), idempotencyKey },
  );
}

export function disconnectConnection(
  workspaceId: string,
  connectionId: string,
): Promise<DisconnectConnectionResponse> {
  return platformServerJson<DisconnectConnectionResponse>(
    `${scope(workspaceId)}/connections/${encodeURIComponent(connectionId)}`,
    { method: "DELETE" },
  );
}

/** Renders an unavailable integration surface as empty, never as a false claim. */
export async function emptyConnectionsWhenUnavailable<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) return fallback;
    throw error;
  }
}
