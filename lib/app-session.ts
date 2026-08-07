import { cookies } from "next/headers";
import { backendApiOrigin } from "@/lib/backend-origin";
import { toAppSession, type AppSession } from "@/lib/session-contract";

export type { AppSession } from "@/lib/session-contract";

/**
 * Resolve the client-safe Autom8x session through the backend Access boundary.
 * This module never imports a database driver or Supabase SDK.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const origin = backendApiOrigin();
  if (!origin) return null;
  const cookieStore = await cookies();
  const response = await fetch(`${origin}/v1/session`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;

  return toAppSession(await response.json().catch(() => null));
}
