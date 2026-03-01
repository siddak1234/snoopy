"use server";

import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import {
  createProject as createProjectDb,
  deleteProject as deleteProjectDb,
  joinProjectByCode as joinProjectByCodeDb,
} from "@/lib/projects";
import { revalidatePath } from "next/cache";

const NAME_MIN = 2;
const NAME_MAX = 60;

export type CreateProjectResult =
  | { ok: true; projectId: string; accessCode: string }
  | { ok: false; error: string };

export async function createProjectAction(
  formData: FormData
): Promise<CreateProjectResult> {
  const session = await getServerSession(getAuthOptions());
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
    revalidatePath("/account");
    revalidatePath("/account/projects");
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
  const session = await getServerSession(getAuthOptions());
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
  const session = await getServerSession(getAuthOptions());
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
