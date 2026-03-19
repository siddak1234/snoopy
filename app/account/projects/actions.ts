"use server";

import { getAppSession } from "@/lib/auth-supabase";
import {
  createProject as createProjectDb,
  deleteProject as deleteProjectDb,
  joinProjectByCode as joinProjectByCodeDb,
  leaveProject as leaveProjectDb,
} from "@/lib/projects";
import { revalidatePath } from "next/cache";

const NAME_MIN = 2;
const NAME_MAX = 60;

/** Call after the user closes the access-code dialog so the projects list refreshes. */
export async function revalidateAccountProjectsAction(): Promise<void> {
  revalidatePath("/account");
  revalidatePath("/account/projects");
}

export type CreateProjectResult =
  | { ok: true; projectId: string; accessCode: string }
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

  const description = formData.get("description");
  const descriptionStr =
    typeof description === "string" && description.trim()
      ? description.trim()
      : null;

  try {
    const { project, accessCode } = await createProjectDb(session.user.id, {
      name: trimmed,
      description: descriptionStr,
    });
    // Do NOT revalidate here: it can refresh the RSC tree and unmount the success modal.
    // Revalidation is done when the user closes the access-code dialog (see CreateProjectButton).
    return { ok: true, projectId: project.id, accessCode };
  } catch (e) {
    console.error("createProjectAction", e);
    return { ok: false, error: "Failed to create project. Please try again." };
  }
}

export type JoinProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function joinProjectByCodeAction(
  code: string
): Promise<JoinProjectResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to join a project." };
  }
  const result = await joinProjectByCodeDb(session.user.id, code);
  if (!result.ok) return result;
  revalidatePath("/account");
  revalidatePath("/account/projects");
  return { ok: true, projectId: result.projectId };
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

/**
 * Leave a project by removing the user's membership (team projects only).
 * This does NOT delete the project itself.
 */
export async function leaveProjectAction(
  projectId: string,
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
      return { ok: false, error: "Unable to leave project (not a member or you are the owner)." };
    }
    revalidatePath("/account");
    revalidatePath("/account/projects");
    return { ok: true };
  } catch (e) {
    console.error("leaveProjectAction", e);
    return { ok: false, error: "Failed to leave project. Please try again." };
  }
}
