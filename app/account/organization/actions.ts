"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/db";

const NAME_MIN = 2;
const NAME_MAX = 80;

// ---------------------------------------------------------------------------
// Update organization name
// ---------------------------------------------------------------------------

export type UpdateWorkspaceNameResult = { ok: true } | { ok: false; error: string };

/**
 * Update the display name of an organization workspace.
 * Only the workspace OWNER may call this.
 */
export async function updateWorkspaceNameAction(
  workspaceId: string,
  newName: string
): Promise<UpdateWorkspaceNameResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const trimmed = newName.trim();
  if (trimmed.length < NAME_MIN) {
    return { ok: false, error: `Name must be at least ${NAME_MIN} characters.` };
  }
  if (trimmed.length > NAME_MAX) {
    return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    select: { role: true },
  });
  if (!membership || membership.role !== "OWNER") {
    return { ok: false, error: "Only the organization owner can update the name." };
  }

  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: trimmed },
    });
    revalidatePath("/account/organization");
    return { ok: true };
  } catch (e) {
    console.error("updateWorkspaceNameAction", e);
    return { ok: false, error: "Failed to update name. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Remove workspace member
// ---------------------------------------------------------------------------

export type RemoveWorkspaceMemberResult =
  | { ok: true }
  | { ok: false; error: string; ownsProjects?: true };

/**
 * Remove a MEMBER from an organization workspace.
 * - Actor must be the workspace OWNER.
 * - Target must be a MEMBER (not OWNER) — owners are not removable.
 * - Blocked if the target owns any projects inside this workspace.
 * - On success: cascades to delete all project_memberships for the target user
 *   in any project belonging to this workspace, then deletes the membership row.
 */
export async function removeWorkspaceMemberAction(
  workspaceId: string,
  targetUserId: string
): Promise<RemoveWorkspaceMemberResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const actorId = session.user.id;
  if (actorId === targetUserId) {
    return { ok: false, error: "You cannot remove yourself from the organization." };
  }

  // Verify actor is OWNER
  const actorMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: actorId, workspaceId } },
    select: { role: true },
  });
  if (!actorMembership || actorMembership.role !== "OWNER") {
    return { ok: false, error: "Only the organization owner can remove members." };
  }

  // Verify target is an existing MEMBER (not OWNER)
  const targetMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    select: { role: true },
  });
  if (!targetMembership) {
    return { ok: false, error: "That user is not a member of this organization." };
  }
  if (targetMembership.role === "OWNER") {
    return { ok: false, error: "The organization owner cannot be removed." };
  }

  // Block if target owns any projects in this workspace
  const ownedCount = await prisma.projectMembership.count({
    where: {
      userId: targetUserId,
      role: "owner",
      project: { workspaceId },
    },
  });
  if (ownedCount > 0) {
    return {
      ok: false,
      ownsProjects: true,
      error: `This member owns ${ownedCount} project${ownedCount === 1 ? "" : "s"} in this organization. Transfer or delete those projects before removing this member.`,
    };
  }

  // Cascade: remove from all workspace projects, then remove from workspace
  try {
    await prisma.$transaction(async (tx) => {
      // Find all projects in this workspace
      const wsProjects = await tx.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const projectIds = wsProjects.map((p) => p.id);

      // Delete project memberships for this user
      if (projectIds.length > 0) {
        await tx.projectMembership.deleteMany({
          where: { userId: targetUserId, projectId: { in: projectIds } },
        });
      }

      // Delete workspace membership
      await tx.membership.delete({
        where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      });
    });

    revalidatePath("/account/organization");
    return { ok: true };
  } catch (e) {
    console.error("removeWorkspaceMemberAction", e);
    return { ok: false, error: "Failed to remove member. Please try again." };
  }
}
