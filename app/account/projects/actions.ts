"use server";

import { getAppSession } from "@/lib/auth-supabase";
import {
  createProject as createProjectDb,
  deleteProject as deleteProjectDb,
  leaveProject as leaveProjectDb,
} from "@/lib/projects";
import { canUserPerform, getProjectRole } from "@/lib/project-rbac";
import { canModifyMember } from "@/lib/project-rbac-pure";
import { prisma } from "@/lib/db";
import type { ProjectMemberRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

const NAME_MIN = 2;
const NAME_MAX = 60;

// ---------------------------------------------------------------------------
// Project lifecycle
// ---------------------------------------------------------------------------

/** Call after the user closes the access-code dialog so the projects list refreshes. */
export async function revalidateAccountProjectsAction(): Promise<void> {
  revalidatePath("/account");
  revalidatePath("/account/projects");
}

export type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function createProjectAction(
  formData: FormData
): Promise<CreateProjectResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to create a project." };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Project name is required." };
  }
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) {
    return { ok: false, error: `Name must be at least ${NAME_MIN} characters.` };
  }
  if (trimmed.length > NAME_MAX) {
    return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` };
  }

  const projectType = formData.get("projectType");
  if (typeof projectType !== "string" || !projectType.trim()) {
    return { ok: false, error: "Project type is required." };
  }

  const description = formData.get("description");
  const descriptionStr =
    typeof description === "string" && description.trim()
      ? description.trim()
      : null;

  const wsId = formData.get("workspaceId");
  const targetWorkspaceId =
    typeof wsId === "string" && wsId.trim() ? wsId.trim() : undefined;

  try {
    const { project } = await createProjectDb(
      session.user.id,
      { name: trimmed, type: projectType.trim(), description: descriptionStr },
      targetWorkspaceId
    );
    // Do NOT revalidate here — it can unmount the success state in the dialog.
    return { ok: true, projectId: project.id };
  } catch (e) {
    console.error("createProjectAction", e);
    return { ok: false, error: "Failed to create project. Please try again." };
  }
}

export type DeleteProjectResult = { ok: true } | { ok: false; error: string };

export async function deleteProjectAction(projectId: string): Promise<DeleteProjectResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to delete a project." };
  }
  if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
    return { ok: false, error: "Project ID is required." };
  }
  try {
    const deleted = await deleteProjectDb(session.user.id, projectId.trim());
    if (!deleted) {
      return { ok: false, error: "Project not found or you don't have permission to delete it." };
    }
    revalidatePath("/account");
    revalidatePath("/account/projects");
    return { ok: true };
  } catch (e) {
    console.error("deleteProjectAction", e);
    return { ok: false, error: "Failed to delete project. Please try again." };
  }
}

export type LeaveProjectResult = { ok: true } | { ok: false; error: string };

export async function leaveProjectAction(
  projectId: string
): Promise<LeaveProjectResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to leave a project." };
  }
  if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
    return { ok: false, error: "Project ID is required." };
  }
  try {
    const left = await leaveProjectDb(session.user.id, projectId.trim());
    if (!left) {
      return {
        ok: false,
        error: "Unable to leave project (not a member or you are the owner).",
      };
    }
    revalidatePath("/account");
    revalidatePath("/account/projects");
    return { ok: true };
  } catch (e) {
    console.error("leaveProjectAction", e);
    return { ok: false, error: "Failed to leave project. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------

export type AddMemberResult = { ok: true } | { ok: false; error: string };

/**
 * Add a workspace member to a project.
 * Caller must hold project:add_member (owner or admin).
 * Target must be a workspace member and not already in the project.
 */
export async function addMemberToProjectAction(
  projectId: string,
  targetUserId: string,
  role: ProjectMemberRole
): Promise<AddMemberResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const [allowed, actorRole] = await Promise.all([
    canUserPerform(session.user.id, projectId, "project:add_member"),
    getProjectRole(session.user.id, projectId),
  ]);
  if (!allowed || !actorRole) {
    return { ok: false, error: "You don't have permission to add members." };
  }
  if (!canModifyMember(actorRole, null, "add")) {
    return { ok: false, error: "You don't have permission to add members." };
  }

  // Reject owner role — only one owner is allowed and it's set at creation
  if (role === "owner" || role === "project_user") {
    return { ok: false, error: "Invalid role. Choose 'member' or 'admin'." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project?.workspaceId) {
    return { ok: false, error: "Project has no associated workspace." };
  }

  const [wsMembership, existing] = await Promise.all([
    prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId: project.workspaceId },
      },
    }),
    prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    }),
  ]);

  if (!wsMembership) {
    return { ok: false, error: "That user is not a member of this workspace." };
  }
  if (existing) {
    return { ok: false, error: "That user is already in this project." };
  }

  try {
    await prisma.projectMembership.create({
      data: { projectId, userId: targetUserId, role },
    });
    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    console.error("addMemberToProjectAction", e);
    return { ok: false, error: "Failed to add member. Please try again." };
  }
}

export type ChangeMemberRoleResult = { ok: true } | { ok: false; error: string };

/**
 * Change a project member's role.
 * Caller must hold project:change_role; canModifyMember enforces admin restrictions.
 */
export async function changeMemberRoleAction(
  projectId: string,
  targetUserId: string,
  newRole: ProjectMemberRole
): Promise<ChangeMemberRoleResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const [allowed, actorRole] = await Promise.all([
    canUserPerform(session.user.id, projectId, "project:change_role"),
    getProjectRole(session.user.id, projectId),
  ]);
  if (!allowed || !actorRole) {
    return { ok: false, error: "You don't have permission to change roles." };
  }

  const targetMembership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    select: { role: true },
  });
  if (!targetMembership) {
    return { ok: false, error: "Target user is not in this project." };
  }

  if (!canModifyMember(actorRole, targetMembership.role, "change_role", newRole)) {
    return { ok: false, error: "You are not allowed to change this member's role." };
  }

  try {
    await prisma.projectMembership.update({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      data: { role: newRole },
    });
    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    console.error("changeMemberRoleAction", e);
    return { ok: false, error: "Failed to change role. Please try again." };
  }
}

export type RemoveMemberResult = { ok: true } | { ok: false; error: string };

/**
 * Remove a member from a project.
 * Caller must hold project:remove_member; canModifyMember enforces admin restrictions.
 * The project owner cannot be removed.
 */
export async function removeMemberFromProjectAction(
  projectId: string,
  targetUserId: string
): Promise<RemoveMemberResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const [allowed, actorRole] = await Promise.all([
    canUserPerform(session.user.id, projectId, "project:remove_member"),
    getProjectRole(session.user.id, projectId),
  ]);
  if (!allowed || !actorRole) {
    return { ok: false, error: "You don't have permission to remove members." };
  }

  const targetMembership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    select: { role: true },
  });
  if (!targetMembership) {
    return { ok: false, error: "Target user is not in this project." };
  }
  if (targetMembership.role === "owner") {
    return { ok: false, error: "The project owner cannot be removed." };
  }

  if (!canModifyMember(actorRole, targetMembership.role, "remove")) {
    return { ok: false, error: "You are not allowed to remove this member." };
  }

  try {
    await prisma.projectMembership.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    console.error("removeMemberFromProjectAction", e);
    return { ok: false, error: "Failed to remove member. Please try again." };
  }
}
