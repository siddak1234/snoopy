import { prisma } from "@/lib/db";
import type { TenantRole } from "@prisma/client";
import { ensureDefaultWorkspaceForUser } from "@/lib/auth";

/**
 * Server-only: get the workspace (org) for the given user. Uses first membership as default workspace.
 * Returns null if user has no workspace (call ensureTenantForUser first).
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

/**
 * Server-only: ensure user has a default workspace. Creates workspace + membership (OWNER) if none.
 * Returns workspaceId (exposed as tenantId for compatibility). Used after sign-in or on first access to projects.
 */
export async function ensureTenantForUser(userId: string): Promise<string> {
  if (!userId) throw new Error("User ID required");
  return ensureDefaultWorkspaceForUser(userId);
}
