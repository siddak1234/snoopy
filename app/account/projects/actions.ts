"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import { PlatformServerError } from "@/lib/platform-server";
import {
  createProject,
  findAccessibleProject,
  listWorkspaces,
  removeProjectMembership,
  updateProject,
  upsertProjectMembership,
  type ProjectRole,
} from "@/lib/tenancy";

function platformMessage(error: unknown, fallback: string): string {
  return error instanceof PlatformServerError ? error.message : fallback;
}

function refreshProjectPaths(projectId?: string): void {
  revalidatePath("/account");
  revalidatePath("/account/projects");
  if (projectId) revalidatePath(`/account/projects/${projectId}`);
}

export async function revalidateAccountProjectsAction(): Promise<void> {
  refreshProjectPaths();
}

export type CreateProjectResult =
  { ok: true; projectId: string } | { ok: false; error: string };

export async function createProjectAction(
  formData: FormData,
): Promise<CreateProjectResult> {
  if (!(await getAppSession())) {
    return { ok: false, error: "You must be signed in to create a project." };
  }
  const name = formData.get("name");
  const type = formData.get("projectType");
  const scope = formData.get("scope");
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Project name is required." };
  }
  if (typeof type !== "string" || !type.trim()) {
    return { ok: false, error: "Project type is required." };
  }
  if (scope !== "personal" && scope !== "team") {
    return { ok: false, error: "Project scope is required." };
  }

  try {
    const workspaces = await listWorkspaces();
    const workspace = workspaces.find(
      (candidate) =>
        candidate.type === (scope === "personal" ? "personal" : "organization"),
    );
    if (!workspace) {
      return {
        ok: false,
        error:
          scope === "team"
            ? "Join an organization to create a team project."
            : "No personal workspace is available.",
      };
    }
    const description = formData.get("description");
    const project = await createProject(workspace.id, {
      name: name.trim(),
      type: type.trim(),
      ...(typeof description === "string" && description.trim()
        ? { description: description.trim() }
        : {}),
    });
    refreshProjectPaths(project.id);
    return { ok: true, projectId: project.id };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The project could not be created."),
    };
  }
}

async function projectContext(projectId: string) {
  const context = await findAccessibleProject(projectId);
  if (!context)
    throw new PlatformServerError("The requested project is unavailable.", 404);
  return context;
}

export type ProjectActionResult = { ok: true } | { ok: false; error: string };

export async function deleteProjectAction(
  projectId: string,
): Promise<ProjectActionResult> {
  try {
    const { workspace } = await projectContext(projectId);
    await updateProject(workspace.id, projectId, { status: "archived" });
    refreshProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The project could not be archived."),
    };
  }
}

export async function restoreProjectAction(
  projectId: string,
): Promise<CreateProjectResult> {
  try {
    const { workspace } = await projectContext(projectId);
    const project = await updateProject(workspace.id, projectId, {
      status: "active",
    });
    refreshProjectPaths(projectId);
    return { ok: true, projectId: project.id };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The project could not be restored."),
    };
  }
}

export async function leaveProjectAction(
  projectId: string,
): Promise<ProjectActionResult> {
  const session = await getAppSession();
  if (!session) return { ok: false, error: "You must be signed in." };
  try {
    const { workspace } = await projectContext(projectId);
    await removeProjectMembership(workspace.id, projectId, session.user.id);
    refreshProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "You could not leave this project."),
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
    refreshProjectPaths(projectId);
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
    refreshProjectPaths(projectId);
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
    refreshProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The member could not be removed."),
    };
  }
}
