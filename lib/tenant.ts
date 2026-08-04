import { prisma } from "@/lib/db";
import type { TenantRole } from "@prisma/client";

/**
 * Server-only: get the workspace (org) for the given user. Uses first membership as default workspace.
 * Returns null if user has no workspace (call ensureDefaultWorkspaceForUser first).
 * Never accept tenant_id or workspace_id from the client; always derive from session user.
 * Return shape kept as { tenantId, role } for compatibility; tenantId is workspaceId.
 */
export async function getTenantForUser(userId: string): Promise<{
  tenantId: string;
  role: TenantRole;
} | null> {
  if (!userId) return null;
  const m = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true, role: true },
  });
  if (!m) return null;
  const role: TenantRole = m.role === "OWNER" ? "org_owner" : "org_user";
  return { tenantId: m.workspaceId, role };
}
