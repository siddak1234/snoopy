"use server";

import { getAppSession } from "@/lib/auth-supabase";
import {
  createProject as createProjectDb,
  deleteProject as deleteProjectDb,
  leaveProject as leaveProjectDb,
} from "@/lib/projects";
import {
  createInvite as createInviteDb,
  revokeInvite as revokeInviteDb,
  acceptInvite as acceptInviteDb,
} from "@/lib/invites";
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

  try {
    const { project } = await createProjectDb(session.user.id, {
      name: trimmed,
      type: projectType.trim(),
      description: descriptionStr,
    });
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
// Invite system
// ---------------------------------------------------------------------------

export type CreateInviteResult =
  | { ok: true; token: string; code: string; expiresAt: Date }
  | { ok: false; error: string };

/** Generate a new invite link + code for a project (owner only). */
export async function createInviteAction(
  projectId: string
): Promise<CreateInviteResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!projectId?.trim()) {
    return { ok: false, error: "Project ID is required." };
  }
  try {
    return await createInviteDb(projectId.trim(), session.user.id);
  } catch (e) {
    console.error("createInviteAction", e);
    return { ok: false, error: "Failed to create invite. Please try again." };
  }
}

export type RevokeInviteResult = { ok: true } | { ok: false; error: string };

/** Revoke a pending invite (owner only). */
export async function revokeInviteAction(
  inviteId: string
): Promise<RevokeInviteResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!inviteId?.trim()) {
    return { ok: false, error: "Invite ID is required." };
  }
  try {
    const result = await revokeInviteDb(inviteId.trim(), session.user.id);
    if (result.ok) {
      revalidatePath("/account/projects");
    }
    return result;
  } catch (e) {
    console.error("revokeInviteAction", e);
    return { ok: false, error: "Failed to revoke invite. Please try again." };
  }
}

export type AcceptInviteResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

/** Accept an invite by token + code. Adds the current user to the project. */
export async function acceptInviteAction(
  token: string,
  code: string
): Promise<AcceptInviteResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to accept an invite." };
  }
  if (!token?.trim() || !code?.trim()) {
    return { ok: false, error: "Token and code are required." };
  }
  try {
    const result = await acceptInviteDb(token.trim(), code.trim(), session.user.id);
    if (result.ok) {
      revalidatePath("/account");
      revalidatePath("/account/projects");
    }
    return result;
  } catch (e) {
    console.error("acceptInviteAction", e);
    return { ok: false, error: "Failed to accept invite. Please try again." };
  }
}
