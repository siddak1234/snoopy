import { prisma } from "@/lib/db";
import type { TenantRole } from "@prisma/client";

/**
 * Server-only: get the tenant (org) for the given user. User must belong to exactly one tenant.
 * Returns null if user has no tenant (call ensureTenantForUser first).
 * Never accept tenant_id from the client; always derive from session user.
 */
export async function getTenantForUser(userId: string): Promise<{
  tenantId: string;
  role: TenantRole;
} | null> {
  const m = await prisma.tenantMembership.findUnique({
    where: { userId },
    select: { tenantId: true, role: true },
  });
  return m;
}

/**
 * Server-only: ensure user has exactly one tenant. Creates a default tenant and membership (org_owner) if none.
 * Returns tenantId. Used after sign-in or on first access to projects.
 */
export async function ensureTenantForUser(userId: string): Promise<string> {
  const existing = await prisma.tenantMembership.findUnique({
    where: { userId },
    select: { tenantId: true },
  });
  if (existing) return existing.tenantId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) throw new Error("User not found");

  const tenantName =
    user.name?.trim()
      ? `${user.name.trim()}'s Organization`
      : user.email?.trim()
        ? `${user.email.trim()}'s Organization`
        : "My Organization";

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: { name: tenantName, ownerUserId: userId },
    });
    await tx.tenantMembership.create({
      data: { tenantId: t.id, userId, role: "org_owner" },
    });
    return t;
  });
  return tenant.id;
}
