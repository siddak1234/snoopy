import { cache } from "react";
import {
  platformServerJson,
  PlatformNotConfiguredError,
  PlatformServerError,
} from "@/lib/platform-server";
import { toAppSession, type AppSession } from "@/lib/session-contract";
import type { components } from "@/lib/generated/platform-contracts/platform";

export type { AppSession } from "@/lib/session-contract";

/**
 * Resolve the client-safe Autom8x session through the backend Access boundary.
 * This module never imports a database driver or Supabase SDK.
 *
 * **`null` means NO SESSION, and nothing else — backend §12.1 #160.** It used to
 * mean any failure at all, so a platform that refused the request (429) or could
 * not answer it (5xx, unreachable) read as "signed out": the account layout sent
 * a signed-in person to `/login`, which is how ordinary use signed people out.
 * Now only a 401 — the Edge saying there is no session — and a site with no
 * backend configured are `null`. Anything else is thrown, for the account area to
 * render as "the platform could not answer" with a way to try again.
 *
 * **Memoised per request** (`cache`), because the account layout and the page it
 * wraps both ask, and each ask was a separate Edge request.
 */
export const getAppSession = cache(async (): Promise<AppSession | null> => {
  try {
    return toAppSession(
      await platformServerJson<components["schemas"]["SessionResponse"]>(
        "/v1/session",
      ),
    );
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) return null;
    if (error instanceof PlatformServerError && error.status === 401) {
      return null;
    }
    throw error;
  }
});
