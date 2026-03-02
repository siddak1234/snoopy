import { prisma } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { ensureTenantForUser, getTenantForUser } from "@/lib/tenant";

const ACCESS_CODE_LENGTH = 8;
const ACCESS_CODE_PREFIX_LENGTH = 4;
const BCRYPT_ROUNDS = 10;

/**
 * Single normalization for access codes. Used on create (before hash/prefix) and join (before lookup/compare).
 * Ensures pasted codes with spaces/hyphens (e.g. "LB4C-7HR8") match the stored hash.
 */
export function normalizeAccessCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s\-]/g, "");
}

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Server-only: list projects owned by the user (in their workspace). Uses workspace from session; never from client.
 * Includes legacy projects (workspaceId/tenantId null, userId = me) until backfilled.
 */
export async function getMyProjects(userId: string) {
  if (!userId) return [];
  const workspace = await getTenantForUser(userId);
  return prisma.project.findMany({
    where: workspace
      ? {
          OR: [
            { workspaceId: workspace.tenantId, OR: [{ ownerUserId: userId }, { userId: userId }] },
            { workspaceId: null, userId },
          ],
        }
      : { userId },
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
 * Server-only: list team projects (projects the user joined via access code, not owned by them).
 */
export async function getTeamProjects(userId: string) {
  if (!userId) return [];
  const memberships = await prisma.projectMembership.findMany({
    where: { userId },
    select: { projectId: true },
  });
  if (memberships.length === 0) return [];
  const projectIds = memberships.map((m) => m.projectId);
  return prisma.project.findMany({
    where: {
      id: { in: projectIds },
      OR: [{ ownerUserId: { not: userId } }, { ownerUserId: null }],
    },
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

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  ownerName: string | null;
};

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
 * Server-only: create a project. tenant_id and owner are derived from session; never from client.
 * Generates access code (stored as hash + prefix only).
 */
export async function createProject(
  userId: string,
  data: { name: string; description?: string | null; status?: ProjectStatus }
) {
  const workspaceId = await ensureTenantForUser(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const ownerName = user?.name?.trim() || "Unknown";

  const rawCode = generateAccessCode();
  const accessCode = normalizeAccessCode(rawCode);
  const accessCodeHash = await bcrypt.hash(accessCode, BCRYPT_ROUNDS);
  const accessCodePrefix = accessCode.slice(0, ACCESS_CODE_PREFIX_LENGTH);

  const project = await prisma.project.create({
    data: {
      workspaceId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: data.status ?? "active",
      userId,
      ownerUserId: userId,
      ownerName,
      accessCodeHash,
      accessCodePrefix,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      ownerName: true,
      accessCodePrefix: true,
    },
  });
  return { project, accessCode };
}

/**
 * Server-only: delete a project. Allowed if user is project owner OR org_owner (OWNER) in the project's workspace.
 */
export async function deleteProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { workspaceId: true, ownerUserId: true, userId: true },
  });
  if (!project) return false;

  const workspace = await getTenantForUser(userId);
  if (!workspace) return false;

  const projectWorkspaceId = project.workspaceId;
  const isSameWorkspace = projectWorkspaceId === workspace.tenantId;
  const isOwner =
    project.ownerUserId === userId || project.userId === userId;
  const isOrgOwner = isSameWorkspace && workspace.role === "org_owner";

  if (!isOwner && !isOrgOwner) return false;

  const result = await prisma.project.deleteMany({
    where: { id: projectId },
  });
  return result.count > 0;
}

/**
 * Server-only: join a project by access code. Verifies code server-side; user must be in same workspace as project.
 * Never trust client for workspace_id or project_id; lookup by code only.
 */
export async function joinProjectByCode(
  userId: string,
  code: string
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const normalized = normalizeAccessCode(code);
  if (normalized.length < ACCESS_CODE_PREFIX_LENGTH) {
    return { ok: false, error: "Invalid access code." };
  }

  const workspace = await getTenantForUser(userId);
  if (!workspace) {
    return { ok: false, error: "No organization found for user. Please refresh and try again." };
  }

  const prefix = normalized.slice(0, ACCESS_CODE_PREFIX_LENGTH);
  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.tenantId, accessCodePrefix: prefix },
    select: {
      id: true,
      name: true,
      accessCodeHash: true,
    },
  });

  for (const p of projects) {
    if (!p.accessCodeHash) continue;
    const match = await bcrypt.compare(normalized, p.accessCodeHash);
    if (match) {
      await prisma.projectMembership.upsert({
        where: {
          projectId_userId: { projectId: p.id, userId },
        },
        create: { projectId: p.id, userId, role: "project_user" },
        update: {},
      });
      return { ok: true, projectId: p.id };
    }
  }
  return { ok: false, error: "Invalid access code." };
}

/**
 * Server-only: get project for display. Allowed if user owns it, is in project_memberships, or is org_owner in project's workspace.
 * Also allows legacy projects (workspaceId/tenantId null) where userId = me.
 */
export async function getProjectForUser(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    include: {
      projectMemberships: { where: { userId }, select: { createdAt: true } },
    },
  });
  if (!project) return null;

  const isOwner =
    project.ownerUserId === userId || project.userId === userId;
  const isMember = project.projectMemberships.length > 0;

  const projectWorkspaceId = project.workspaceId;
  if (projectWorkspaceId) {
    const workspace = await getTenantForUser(userId);
    if (!workspace) return isOwner || isMember ? project : null;
    const isOrgOwner = workspace.role === "org_owner";
    if (workspace.tenantId !== projectWorkspaceId && !isOwner && !isMember)
      return null;
    if (isOwner || isMember || isOrgOwner) return project;
  } else {
    if (isOwner || isMember) return project;
  }
  return null;
}

/** Backward compat: list all projects for user (owned only, for callers that don't need my/team split yet). */
export async function getProjectsForUser(userId: string) {
  return getMyProjects(userId);
}
