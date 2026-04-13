import { prisma } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";
import { ensureTenantForUser, getTenantForUser } from "@/lib/tenant";
import { canUserPerform, isProjectMember } from "@/lib/project-rbac";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  ownerName: string | null;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Server-only: list projects owned by the user.
 * Queries via projectMemberships (role = "owner") — the canonical source after
 * the RBAC migration. Falls back to legacy userId/ownerUserId for projects
 * created before the backfill ran (safety net; should be empty after migration).
 */
export async function getMyProjects(userId: string) {
  if (!userId) return [];

  // Primary: projects where the user has an explicit owner membership row
  const ownerMemberships = await prisma.projectMembership.findMany({
    where: { userId, role: "owner" },
    select: { projectId: true },
  });
  const ownedProjectIds = ownerMemberships.map((m) => m.projectId);

  if (ownedProjectIds.length === 0) return [];

  return prisma.project.findMany({
    where: { id: { in: ownedProjectIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      ownerName: true,
      accessCodePrefix: true,
      ownerUserId: true,
      userId: true,
    },
  });
}

/**
 * Server-only: list team projects (projects the user joined as member, not owner).
 */
export async function getTeamProjects(userId: string) {
  if (!userId) return [];

  const memberMemberships = await prisma.projectMembership.findMany({
    where: { userId, role: { in: ["member", "project_user"] } },
    select: { projectId: true },
  });
  if (memberMemberships.length === 0) return [];

  const projectIds = memberMemberships.map((m) => m.projectId);
  return prisma.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      ownerName: true,
      projectMemberships: {
        where: { userId },
        select: { createdAt: true },
        take: 1,
      },
    },
  });
}

/**
 * Server-only: list all projects the user can access (owned + team) for home dashboard.
 */
export async function getAccessibleProjects(
  userId: string,
  limit: number = 10
): Promise<ProjectSummary[]> {
  if (!userId) return [];
  const [owned, team] = await Promise.all([
    getMyProjects(userId),
    getTeamProjects(userId),
  ]);
  const seen = new Set<string>();
  const combined: ProjectSummary[] = [];
  for (const p of owned) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      combined.push({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt,
        ownerName: p.ownerName,
      });
    }
  }
  for (const p of team) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      combined.push({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt,
        ownerName: p.ownerName,
      });
    }
  }
  combined.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return combined.slice(0, limit);
}

/**
 * Server-only: get project for display. Any membership role grants access.
 * Also allows org_owners in the same workspace to see the project.
 */
export async function getProjectForUser(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    include: {
      projectMemberships: {
        where: { userId },
        select: { role: true, createdAt: true },
      },
    },
  });
  if (!project) return null;

  const hasMembership = project.projectMemberships.length > 0;
  if (hasMembership) return project;

  // Org-owner bypass: workspace owners can view any project in their workspace
  const projectWorkspaceId = project.workspaceId;
  if (projectWorkspaceId) {
    const workspace = await getTenantForUser(userId);
    if (workspace?.tenantId === projectWorkspaceId && workspace.role === "org_owner") {
      return project;
    }
  }

  return null;
}

/**
 * Server-only: get the full member list for a project.
 * Caller must already have verified the user can view members (project:view_members).
 */
export async function getProjectMembers(projectId: string) {
  return prisma.projectMembership.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Server-only: create a project and immediately create an owner membership row.
 * Done in a transaction so neither can succeed without the other.
 */
export async function createProject(
  userId: string,
  data: { name: string; type?: string; description?: string | null; status?: ProjectStatus }
) {
  const workspaceId = await ensureTenantForUser(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const ownerName = user?.name?.trim() || "Unknown";

  const [project] = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        type: data.type?.trim() ?? "",
        description: data.description?.trim() || null,
        status: data.status ?? "active",
        userId,
        ownerUserId: userId,
        ownerName,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        ownerName: true,
      },
    });

    // Create the owner membership row — this is the RBAC source of truth
    await tx.projectMembership.create({
      data: { projectId: created.id, userId, role: "owner" },
    });

    return [created];
  });

  return { project };
}

/**
 * Server-only: delete a project.
 * Allowed if the user has project:delete permission (owner role) OR is org_owner
 * in the project's workspace.
 */
export async function deleteProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return false;

  const canDelete = await canUserPerform(userId, projectId, "project:delete");
  if (canDelete) {
    const result = await prisma.project.deleteMany({ where: { id: projectId } });
    return result.count > 0;
  }

  // Org-owner bypass
  const workspace = await getTenantForUser(userId);
  const isOrgOwner =
    workspace?.role === "org_owner" &&
    workspace.tenantId === project.workspaceId;
  if (!isOrgOwner) return false;

  const result = await prisma.project.deleteMany({ where: { id: projectId } });
  return result.count > 0;
}

/**
 * Server-only: leave a project (remove the user's membership).
 * Only allowed when the user has the project:leave action (member / project_user roles).
 * Owners lack this action intentionally — they must delete the project instead.
 */
export async function leaveProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!userId || !projectId) return false;

  const canLeave = await canUserPerform(userId, projectId, "project:leave");
  if (!canLeave) return false;

  const result = await prisma.projectMembership.deleteMany({
    where: { projectId, userId },
  });
  return result.count > 0;
}

/** Backward compat: list all projects for user (owned only). */
export async function getProjectsForUser(userId: string) {
  return getMyProjects(userId);
}

/** @deprecated Use the invite system instead. Kept temporarily for rollback safety. */
export async function joinProjectByCode(
  _userId: string,
  _code: string
): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "Access code joining has been replaced by the invite system." };
}
