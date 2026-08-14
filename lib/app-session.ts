import { platformServerJson } from "@/lib/platform-server";
import { toAppSession, type AppSession } from "@/lib/session-contract";
import type { components } from "@/lib/generated/platform-contracts/platform";

export type { AppSession } from "@/lib/session-contract";

/**
 * Resolve the client-safe Autom8x session through the backend Access boundary.
 * This module never imports a database driver or Supabase SDK.
 */
export async function getAppSession(): Promise<AppSession | null> {
  try {
    return toAppSession(
      await platformServerJson<components["schemas"]["SessionResponse"]>(
        "/v1/session",
      ),
    );
  } catch {
    return null;
  }
}
