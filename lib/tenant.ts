import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAuthOptions } from "@/lib/auth";

/**
 * Server-only: get current userId and workspaceId from session.
 * Redirects to /login if session or workspace is missing.
 * Do not use in middleware (uses getServerSession + optional DB in auth flow).
 */
export async function requireTenant(): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id || !session?.user?.workspaceId) {
    redirect("/login?callbackUrl=/dashboard");
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
  };
}
