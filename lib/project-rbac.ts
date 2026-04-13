import type { ProjectMemberRole } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
// Every operation that can be performed within a project must appear here.
// Adding a new action is a one-line change; it becomes enforceable immediately
// by adding it to the relevant role(s) in ROLE_PERMISSIONS below.
// ---------------------------------------------------------------------------
export type ProjectAction =
  | "project:view"             // view project details
  | "project:delete"           // delete the project entirely
  | "project:manage_settings"  // edit name, type, description, status
  | "project:create_invite"    // generate an invite link + code
  | "project:revoke_invite"    // cancel a pending invite
  | "project:view_members"     // see the member list
  | "project:remove_member"    // kick another member
  | "project:access_workflows" // use workflows linked to this project
  | "project:leave";           // remove own membership

// ---------------------------------------------------------------------------
// Permissions map
// ---------------------------------------------------------------------------
// To add a new role (e.g. "admin", "viewer"):
//   1. Add the value to the ProjectMemberRole enum in schema.prisma
//   2. Run `prisma migrate dev`
//   3. Add an entry here — done.
// ---------------------------------------------------------------------------
const ROLE_PERMISSIONS: Record<ProjectMemberRole, ReadonlySet<ProjectAction>> =
  {
    owner: new Set<ProjectAction>([
      "project:view",
      "project:delete",
      "project:manage_settings",
      "project:create_invite",
      "project:revoke_invite",
      "project:view_members",
      "project:remove_member",
      "project:access_workflows",
      // owners do NOT get "project:leave" — they must delete the project
    ]),
    member: new Set<ProjectAction>([
      "project:view",
      "project:access_workflows",
      "project:leave",
    ]),
    // legacy role — identical permissions to member, kept for backwards compat
    project_user: new Set<ProjectAction>([
      "project:view",
      "project:access_workflows",
      "project:leave",
    ]),
  };

// ---------------------------------------------------------------------------
// Core check — single DB lookup, indexed on (projectId, userId)
// ---------------------------------------------------------------------------

/**
 * Returns true if userId holds a project membership whose role grants action.
 * All authorization checks in lib/projects.ts and server actions must go
 * through this instead of scattered ownerUserId comparisons.
 */
export async function canUserPerform(
  userId: string,
  projectId: string,
  action: ProjectAction
): Promise<boolean> {
  if (!userId || !projectId) return false;
  const membership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!membership) return false;
  return (ROLE_PERMISSIONS[membership.role] ?? new Set()).has(action);
}

/**
 * Returns the user's ProjectMemberRole in a project, or null if not a member.
 * Use this when the caller needs the role itself (e.g. to conditionally render UI).
 */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectMemberRole | null> {
  if (!userId || !projectId) return null;
  const membership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/**
 * Returns true if the user has any membership in the project (any role).
 * Faster than canUserPerform when you only need an existence check.
 */
export async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!userId || !projectId) return false;
  const membership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return membership !== null;
}
