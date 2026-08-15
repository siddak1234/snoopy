import {
  platformServerJson,
  PlatformNotConfiguredError,
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

function scope(workspaceId: string): string {
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function listConnectionProviders(): Promise<ConnectionProvidersResponse> {
  return platformServerJson("/v1/connections/providers");
}

export function listConnections(
  workspaceId: string,
): Promise<ConnectionsResponse> {
  return platformServerJson(`${scope(workspaceId)}/connections`);
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
