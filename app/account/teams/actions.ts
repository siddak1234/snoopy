"use server";

import { revalidatePath } from "next/cache";
import { PlatformServerError } from "@/lib/platform-server";
import {
  activeWorkspaceIfShown,
  createTeam,
  findAccessibleProject,
  grantProjectTeam,
  removeTeamMembership,
  revokeProjectTeam,
  upsertTeamMembership,
  WORKSPACE_CHANGED,
  type ProjectTeamGrantRole,
  type TeamRole,
} from "@/lib/tenancy";

/**
 * The five team writes (backend ADR-0010, §12.1 #173 and #174), each showing the
 * platform's refusal in place: who may do what is the platform's to decide, and
 * a page only avoids offering what it would refuse. A team's two writes act on
 * the session's active workspace while it is still the one the page showed
 * (register F28), so a switch in another tab cannot create a team elsewhere. A
 * grant acts on the project's own workspace, resolved here as every project
 * action resolves it, because a project's page may show one from a workspace
 * that is not the active one.
 */

export type TeamActionResult = { ok: true } | { ok: false; error: string };

function refused(error: unknown, fallback: string): TeamActionResult {
  return {
    ok: false,
    error: error instanceof PlatformServerError ? error.message : fallback,
  };
}

const TEAM_ROLES: readonly TeamRole[] = ["manager", "member"];
const GRANT_ROLES: readonly ProjectTeamGrantRole[] = ["admin", "member"];

export async function createTeamAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  // The contract's own bounds, said before a request is spent on them.
  if (name.length < 2) {
    return { ok: false, error: "A team name needs at least two characters." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(
      String(formData.get("workspaceId") ?? ""),
    );
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await createTeam(workspaceId, {
      name,
      ...(description ? { description } : {}),
    });
    revalidatePath("/account/teams");
    return { ok: true };
  } catch (error) {
    return refused(error, "The team could not be created.");
  }
}

/** Adds a workspace member to a team, or changes their team role. */
export async function upsertTeamMemberAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as TeamRole;
  if (!teamId || !userId) {
    return { ok: false, error: "Choose who to add to the team." };
  }
  if (!TEAM_ROLES.includes(role)) {
    return { ok: false, error: "Choose manager or member." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(
      String(formData.get("workspaceId") ?? ""),
    );
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await upsertTeamMembership(workspaceId, teamId, {
      userId,
      role,
    });
    revalidatePath(`/account/teams/${teamId}`);
    return { ok: true };
  } catch (error) {
    return refused(error, "The team member could not be saved.");
  }
}

/** Grants a team a role on a project, or changes it. Never ownership. */
export async function grantProjectTeamAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const role = String(formData.get("role") ?? "") as ProjectTeamGrantRole;
  if (!projectId || !teamId) {
    return { ok: false, error: "Choose a team." };
  }
  if (!GRANT_ROLES.includes(role)) {
    return { ok: false, error: "Choose admin or member." };
  }
  try {
    const context = await findAccessibleProject(projectId);
    if (!context) {
      return { ok: false, error: "The project is unavailable." };
    }
    await grantProjectTeam(context.workspace.id, projectId, {
      teamId,
      role,
    });
    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return refused(error, "The team could not be given access.");
  }
}

/**
 * Takes someone off a team (backend §12.1 #174). Bound in the team's page to
 * the workspace it showed, which must still be the active one (register F28).
 */
export async function removeTeamMemberAction(
  shownWorkspaceId: string,
  teamId: string,
  userId: string,
): Promise<TeamActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await removeTeamMembership(workspaceId, teamId, userId);
    revalidatePath(`/account/teams/${teamId}`);
    return { ok: true };
  } catch (error) {
    return refused(error, "The team member could not be removed.");
  }
}

/** Withdraws a team's access to a project, in the project's own workspace. */
export async function revokeProjectTeamAction(
  projectId: string,
  teamId: string,
): Promise<TeamActionResult> {
  try {
    const context = await findAccessibleProject(projectId);
    if (!context) {
      return { ok: false, error: "The project is unavailable." };
    }
    await revokeProjectTeam(context.workspace.id, projectId, teamId);
    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return refused(error, "The team's access could not be removed.");
  }
}
