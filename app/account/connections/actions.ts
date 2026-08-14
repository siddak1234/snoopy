"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import type {
  ConnectionAuthorizationResponse,
  ConnectProviderWithKeyRequest,
  ConnectProviderWithKeyResponse,
  DisconnectConnectionResponse,
} from "@/lib/connections";
import { platformServerJson, PlatformServerError } from "@/lib/platform-server";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

export type ConnectionActionResult =
  | { ok: true; authorizationUrl?: string }
  | { ok: false; error: string; retryWithSameIntent?: boolean };

async function activeWorkspaceId(): Promise<string> {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) throw new PlatformServerError("No active workspace", 401);
  return workspaceId;
}

function failure(error: unknown): ConnectionActionResult {
  if (error instanceof PlatformServerError) {
    return {
      ok: false,
      error: error.message,
      ...(error.status === 409 ? { retryWithSameIntent: true } : {}),
    };
  }
  throw error;
}

export async function beginConnectionAuthorization(
  providerId: string,
): Promise<ConnectionActionResult> {
  try {
    const workspaceId = await activeWorkspaceId();
    const result = await platformServerJson<ConnectionAuthorizationResponse>(
      `/v1/workspaces/${workspaceId}/connections/authorize`,
      {
        method: "POST",
        body: JSON.stringify({ providerId }),
      },
    );
    return { ok: true, authorizationUrl: result.authorizationUrl };
  } catch (error) {
    return failure(error);
  }
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
    const workspaceId = await activeWorkspaceId();
    const body: ConnectProviderWithKeyRequest = { providerId, credentials };
    await platformServerJson<ConnectProviderWithKeyResponse>(
      `/v1/workspaces/${workspaceId}/connections/key`,
      {
        method: "POST",
        body: JSON.stringify(body),
        // The browser mints this once when Connect is chosen. A retry reuses the
        // same form value; it is deliberately not part of the JSON body.
        idempotencyKey,
      },
    );
    revalidatePath("/account/connections");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectConnection(
  connectionId: string,
): Promise<ConnectionActionResult> {
  try {
    const workspaceId = await activeWorkspaceId();
    await platformServerJson<DisconnectConnectionResponse>(
      `/v1/workspaces/${workspaceId}/connections/${encodeURIComponent(connectionId)}`,
      { method: "DELETE" },
    );
    revalidatePath("/account/connections");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
