"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import { PlatformServerError } from "@/lib/platform-server";
import {
  cancelProjectAccess,
  decideProjectAccess,
  findAccessibleProject,
  listAccessRequests,
  listWorkspaces,
  removeProjectMembership,
  requestProjectAccess,
  updateProject,
  upsertProjectMembership,
  type ProjectRole,
} from "@/lib/tenancy";

/**
 * A team — a project, in the platform's contract — and everything a person does
 * with one (BUILD-PLAN 24.11.11). No one creates a team here: a flow goes to
 * the team of its category, which the platform makes when it is first needed
 * (backend ADR-0036; the owner, 2026-10-14: "theres no choose a team. there
 * will be pre existing teams depending on which flows are added"). Every
 * action names its workspace: asking onto a team in the organization whose
 * directory listed it; and every
 * change to one in the workspace that holds it, resolved here on the server —
 * never whichever workspace happens to be active (register F28, F57).
 */

function platformMessage(error: unknown, fallback: string): string {
  return error instanceof PlatformServerError ? error.message : fallback;
}

/**
 * The platform's refusals for asking onto a team, said as sentences: its
 * problem titles ("Conflict", "Not Found") name the status, not what happened.
 */
function accessMessage(error: unknown, fallback: string): string {
  if (error instanceof PlatformServerError) {
    if (error.status === 409)
      return "This team or your request changed. Reload to see where it stands.";
    if (error.status === 404) return "That team is not available to you.";
    return error.message;
  }
  return fallback;
}

function refreshTeamPaths(projectId?: string): void {
  revalidatePath("/account");
  revalidatePath("/account/teams");
  if (projectId) revalidatePath(`/account/teams/${projectId}`);
}

/** A workspace the person is in — the only kind an action here will name. */
async function workspaceTheyAreIn(workspaceId: string) {
  return (await listWorkspaces()).find(
    (candidate) => candidate.id === workspaceId,
  );
}

async function projectContext(projectId: string) {
  const context = await findAccessibleProject(projectId);
  if (!context)
    throw new PlatformServerError("The requested team is unavailable.", 404);
  return context;
}

export type ProjectActionResult = { ok: true } | { ok: false; error: string };

export async function deleteProjectAction(
  projectId: string,
): Promise<ProjectActionResult> {
  try {
    const { workspace } = await projectContext(projectId);
    await updateProject(workspace.id, projectId, { status: "archived" });
    refreshTeamPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The team could not be deleted."),
    };
  }
}

export async function leaveProjectAction(
  projectId: string,
): Promise<ProjectActionResult> {
  try {
    // Inside the try: a refused session read is not "signed out".
    const session = await getAppSession();
    if (!session) return { ok: false, error: "You must be signed in." };
    const { workspace } = await projectContext(projectId);
    await removeProjectMembership(workspace.id, projectId, session.user.id);
    refreshTeamPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "You could not leave this team."),
    };
  }
}

export async function addMemberToProjectAction(
  projectId: string,
  targetUserId: string,
  role: ProjectRole,
): Promise<ProjectActionResult> {
  if (role === "owner") return { ok: false, error: "Choose member or admin." };
  try {
    const { workspace } = await projectContext(projectId);
    await upsertProjectMembership(workspace.id, projectId, {
      userId: targetUserId,
      role,
    });
    refreshTeamPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The member could not be added."),
    };
  }
}

export async function changeMemberRoleAction(
  projectId: string,
  targetUserId: string,
  role: ProjectRole,
): Promise<ProjectActionResult> {
  try {
    const { workspace } = await projectContext(projectId);
    await upsertProjectMembership(workspace.id, projectId, {
      userId: targetUserId,
      role,
    });
    refreshTeamPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The member role could not be updated."),
    };
  }
}

export async function removeMemberFromProjectAction(
  projectId: string,
  targetUserId: string,
): Promise<ProjectActionResult> {
  try {
    const { workspace } = await projectContext(projectId);
    await removeProjectMembership(workspace.id, projectId, targetUserId);
    refreshTeamPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The member could not be removed."),
    };
  }
}

/**
 * Asks to join a team the organization's directory listed. The person cannot
 * see the team yet, so it is named by the workspace the directory was read
 * from — one they are in — and the platform decides whether they may ask.
 */
export async function requestTeamAccessAction(
  workspaceId: string,
  projectId: string,
): Promise<ProjectActionResult> {
  try {
    if (!(await workspaceTheyAreIn(workspaceId))) {
      return { ok: false, error: "That workspace is not one you are in." };
    }
    await requestProjectAccess(workspaceId, projectId);
    refreshTeamPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: accessMessage(error, "Your request could not be sent."),
    };
  }
}

/**
 * Withdraws this person's own pending request. Matched by their user id: an
 * organization's owner or admin reads everyone's requests, and the platform
 * withdraws only the asker's own.
 */
export async function withdrawTeamAccessAction(
  workspaceId: string,
  projectId: string,
): Promise<ProjectActionResult> {
  try {
    const session = await getAppSession();
    if (!session) return { ok: false, error: "You must be signed in." };
    if (!(await workspaceTheyAreIn(workspaceId))) {
      return { ok: false, error: "That workspace is not one you are in." };
    }
    const pending = (await listAccessRequests(workspaceId, projectId)).find(
      (request) =>
        request.status === "pending" && request.userId === session.user.id,
    );
    if (pending) await cancelProjectAccess(workspaceId, projectId, pending.id);
    refreshTeamPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: accessMessage(error, "Your request could not be withdrawn."),
    };
  }
}

/** Approves or denies a request, in the workspace that holds the team. */
export async function decideTeamAccessAction(
  projectId: string,
  requestId: string,
  decision: "approve" | "deny",
): Promise<ProjectActionResult> {
  try {
    const { workspace } = await projectContext(projectId);
    await decideProjectAccess(workspace.id, projectId, requestId, decision);
    refreshTeamPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: accessMessage(error, "The request could not be answered."),
    };
  }
}
