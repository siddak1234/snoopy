"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";
import { provisionUserFromSupabaseAuth } from "@/lib/auth-supabase";
import {
  createWorkspaceInvite,
  validateAndAcceptWorkspaceInvite,
  revokeWorkspaceInvite,
} from "@/lib/workspace-invites";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateWorkspaceInviteActionResult =
  | { ok: true; id: string; token: string; code: string; expiresAt: Date }
  | { ok: false; error: string };

/** Generate a new invite link + code for a workspace (OWNER only). */
export async function createWorkspaceInviteAction(
  workspaceId: string
): Promise<CreateWorkspaceInviteActionResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!workspaceId?.trim()) {
    return { ok: false, error: "Workspace ID is required." };
  }
  try {
    return await createWorkspaceInvite(workspaceId.trim(), session.user.id);
  } catch (e) {
    console.error("createWorkspaceInviteAction", e);
    return { ok: false, error: "Failed to create invite. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

export type RevokeWorkspaceInviteActionResult = { ok: true } | { ok: false; error: string };

/** Revoke a pending workspace invite (OWNER only). */
export async function revokeWorkspaceInviteAction(
  inviteId: string
): Promise<RevokeWorkspaceInviteActionResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!inviteId?.trim()) {
    return { ok: false, error: "Invite ID is required." };
  }
  try {
    const result = await revokeWorkspaceInvite(inviteId.trim(), session.user.id);
    if (result.ok) {
      revalidatePath("/account");
      revalidatePath("/account/organization");
    }
    return result;
  } catch (e) {
    console.error("revokeWorkspaceInviteAction", e);
    return { ok: false, error: "Failed to revoke invite. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

export type AcceptWorkspaceInviteActionResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

/**
 * Accept a workspace invite by token + code. Adds the current user as a MEMBER.
 *
 * Uses direct Supabase auth (not getAppSession) to avoid triggering personal
 * workspace creation for brand-new users who come through an invite link.
 */
export async function acceptWorkspaceInviteAction(
  token: string,
  code: string
): Promise<AcceptWorkspaceInviteActionResult> {
  let userId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "You must be signed in to accept an invite." };
    }
    const provisioned = await provisionUserFromSupabaseAuth(user);
    userId = provisioned.id;
  } catch {
    return { ok: false, error: "You must be signed in to accept an invite." };
  }

  if (!token?.trim() || !code?.trim()) {
    return { ok: false, error: "Token and code are required." };
  }

  try {
    const result = await validateAndAcceptWorkspaceInvite(
      token.trim(),
      code.trim(),
      userId
    );
    if (result.ok) {
      revalidatePath("/account");
    }
    return result;
  } catch (e) {
    console.error("acceptWorkspaceInviteAction", e);
    return { ok: false, error: "Failed to accept invite. Please try again." };
  }
}
