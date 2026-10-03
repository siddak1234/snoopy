"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import { PlatformServerError } from "@/lib/platform-server";
import { OTHER_TEAM_TYPE } from "@/lib/team-types";
import {
  activeWorkspaceIfShown,
  cancelProjectAccess,
  createProject,
  decideProjectAccess,
  findAccessibleProject,
  listAccessRequests,
  listWorkspaces,
  removeProjectMembership,
  requestProjectAccess,
  updateProject,
  upsertProjectMembership,
  WORKSPACE_CHANGED,
  type ProjectRole,
} from "@/lib/tenancy";

/**
 * A team — a project, in the platform's contract — and everything a person does
 * with one (BUILD-PLAN 24.11.11). Every action names its workspace: creating
 * one in the workspace the page showed, while it is still the active one;
 * asking onto one in the organization whose directory listed it; and every
 * change to one in the workspace that holds it, resolved here on the server —
 * never whichever workspace happens to be active (register F28, F57).
 */

function platformMessage(error: unknown, fallback: string): string {
  return error instanceof PlatformServerError ? error.message : fallback;
}

/**
 * Create's refusals in the app's words (build 10): a kind the workspace
 * already has a team for — one team per kind, matched without case, an
 * archived team freeing its kind — and a plain member of an organization, where
 * only its owners and admins create teams. Anything else is the platform's own.
 */
function createRefusal(error: unknown, kind: string): string {
  if (error instanceof PlatformServerError) {
    if (error.status === 409 && error.details?.reason === "team_kind_taken")
      return `This workspace already has a team for ${kind}.`;
    if (error.status === 403)
      return "Only an owner or admin can create a team here.";
  }
  return platformMessage(error, "The team could not be created.");
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

export async function revalidateAccountTeamsAction(): Promise<void> {
  refreshTeamPaths();
}

/** A workspace the person is in — the only kind an action here will name. */
async function workspaceTheyAreIn(workspaceId: string) {
  return (await listWorkspaces()).find(
    (candidate) => candidate.id === workspaceId,
  );
}

export type CreateProjectResult =
  { ok: true; projectId: string } | { ok: false; error: string };

/**
 * A team is its kind (the owner, build 9): the kind picked — or the person's
 * own words under Other, 2 to 60 characters, the platform's limit on a team's
 * name — is sent as both its name and its type, with no description.
 */
export async function createProjectAction(
  formData: FormData,
): Promise<CreateProjectResult> {
  const kind = formData.get("teamKind");
  const other = formData.get("teamKindOther");
  if (typeof kind !== "string" || !kind) {
    return { ok: false, error: "Pick the kind of team." };
  }
  const type =
    kind === OTHER_TEAM_TYPE
      ? typeof other === "string"
        ? other.trim()
        : ""
      : kind;
  if (type.length < 2 || type.length > 60) {
    return {
      ok: false,
      error: "Say what kind of team it is, in 2 to 60 characters.",
    };
  }

  try {
    // Inside the try: a refused session read is the platform's answer to show,
    // not "signed out" (backend §12.1 #160).
    if (!(await getAppSession())) {
      return { ok: false, error: "You must be signed in to create a team." };
    }
    // The workspace the dialog named, while it is still the active one — never
    // the first organization on a list, and never one another tab switched to
    // after the page rendered (register F57, F28).
    const workspaceId = await activeWorkspaceIfShown(
      String(formData.get("workspaceId") ?? ""),
    );
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    const project = await createProject(workspaceId, { name: type, type });
    // No refresh here: the dialog first says the team is made, and closing it
    // asks for the lists again (`revalidateAccountTeamsAction`). A refresh now
    // re-renders the page under the dialog — and on an empty Teams page the
    // dialog's button goes with the empty screen it sits on.
    return { ok: true, projectId: project.id };
  } catch (error) {
    return { ok: false, error: createRefusal(error, type) };
  }
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
    // Inside the try, as createProjectAction's: a refusal is not "signed out".
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
