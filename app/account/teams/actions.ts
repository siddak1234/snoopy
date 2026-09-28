"use server";

import { revalidatePath } from "next/cache";
import { PlatformServerError } from "@/lib/platform-server";
import {
  createTeam,
  grantProjectTeam,
  requireActiveWorkspaceId,
  upsertTeamMembership,
  type ProjectTeamGrantRole,
  type TeamRole,
} from "@/lib/tenancy";

/**
 * The three team writes (backend ADR-0010, §12.1 #173). Each acts on the
 * session's active workspace (register F28) and shows the platform's refusal in
 * place: who may do what is the platform's to decide, and a page only avoids
 * offering what it would refuse.
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
    await createTeam(await requireActiveWorkspaceId(), {
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
    await upsertTeamMembership(await requireActiveWorkspaceId(), teamId, {
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
    await grantProjectTeam(await requireActiveWorkspaceId(), projectId, {
      teamId,
      role,
    });
    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return refused(error, "The team could not be given access.");
  }
}
