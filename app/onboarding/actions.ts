"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { provisionUserFromSupabaseAuth } from "@/lib/auth-supabase";
import { ensureDefaultWorkspaceForUser } from "@/lib/auth";
import { extractDomain } from "@/lib/domain-utils";

// ---------------------------------------------------------------------------
// Internal helper — get authenticated user ID + email from active session.
// Throws if not authenticated (onboarding pages are middleware-gated, so this
// should only happen if someone hits the action without a session).
// ---------------------------------------------------------------------------

async function getSessionIdentity(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Not authenticated");
  const { id: userId } = await provisionUserFromSupabaseAuth(user);
  return { userId, email: user.email };
}

// ---------------------------------------------------------------------------
// Shared guard — block org creation/join if the user already has an org
// workspace. A pre-existing personal workspace is fine: users who signed up
// before the onboarding flow existed (or who were auto-provisioned with a
// personal workspace) must still be able to create an org.
// ---------------------------------------------------------------------------

async function assertNoOrgWorkspace(userId: string): Promise<void> {
  const existing = await prisma.membership.findFirst({
    where: { userId, workspace: { type: "organization" } },
    select: { workspaceId: true },
  });
  if (existing) redirect("/account");
}

// ---------------------------------------------------------------------------
// createOrgWorkspaceAction
// ---------------------------------------------------------------------------
// Creates a new workspace (type: "organization") with the user's email domain
// and a Membership row (OWNER). Domain is derived server-side — never trusted
// from the form.
// ---------------------------------------------------------------------------

export type CreateOrgResult = { ok: true } | { ok: false; error: string };

export async function createOrgWorkspaceAction(
  formData: FormData
): Promise<CreateOrgResult> {
  let userId: string;
  let email: string;
  try {
    ({ userId, email } = await getSessionIdentity());
  } catch {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Organization name is required." };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Organization name must be at least 2 characters." };
  }
  if (trimmed.length > 80) {
    return { ok: false, error: "Organization name must be at most 80 characters." };
  }

  const domain = extractDomain(email);
  if (!domain) {
    return { ok: false, error: "Could not determine your email domain." };
  }

  try {
    await assertNoOrgWorkspace(userId);

    // One-domain-one-org rule: if an org already exists for this email's
    // domain, refuse to create a duplicate. Defense-in-depth on top of the
    // DB-level partial unique index on workspaces(domain) WHERE type='organization'.
    const existing = await prisma.workspace.findFirst({
      where: { domain, type: "organization" },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        error: `An organization for ${domain} already exists. You should join it instead of creating a new one.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: trimmed,
          type: "organization",
          domain,
        },
      });
      await tx.membership.create({
        data: { userId, workspaceId: workspace.id, role: "OWNER" },
      });
    });

    return { ok: true };
  } catch (e) {
    // Re-throw Next.js redirects (from assertNoOrgWorkspace)
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("createOrgWorkspaceAction", e);
    return { ok: false, error: "Failed to create organization. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// createPersonalWorkspaceAction
// ---------------------------------------------------------------------------
// "Skip" path — creates a standard personal workspace via the same idempotent
// helper that getAppSession() uses.
// ---------------------------------------------------------------------------

export type CreatePersonalResult = { ok: true } | { ok: false; error: string };

export async function createPersonalWorkspaceAction(): Promise<CreatePersonalResult> {
  let userId: string;
  try {
    ({ userId } = await getSessionIdentity());
  } catch {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  try {
    await ensureDefaultWorkspaceForUser(userId);
    return { ok: true };
  } catch (e) {
    console.error("createPersonalWorkspaceAction", e);
    return { ok: false, error: "Failed to create personal account. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// joinOrgWorkspaceAction
// ---------------------------------------------------------------------------
// The workspaceId from the URL is used only for display — this action ignores
// it entirely. Instead we re-derive the workspace by looking up the verified
// domain that matches the user's own email. This prevents a tampered URL from
// joining the wrong org.
// ---------------------------------------------------------------------------

export type JoinOrgResult = { ok: true } | { ok: false; error: string };

export async function joinOrgWorkspaceAction(): Promise<JoinOrgResult> {
  let userId: string;
  let email: string;
  try {
    ({ userId, email } = await getSessionIdentity());
  } catch {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  const domain = extractDomain(email);
  if (!domain) {
    return { ok: false, error: "Could not determine your email domain." };
  }

  try {
    await assertNoOrgWorkspace(userId);

    // Re-verify server-side: look up the org workspace by domain.
    // The URL param is never consulted — only the user's own email domain
    // matters (Supabase OAuth already verified that the user reads mail at
    // that domain).
    const workspace = await prisma.workspace.findFirst({
      where: { domain, type: "organization" },
      select: { id: true, name: true },
    });

    if (!workspace) {
      return {
        ok: false,
        error:
          "No organization found for your email domain. It may have been removed.",
      };
    }

    // Upsert to handle the rare case where a Membership row already exists
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      create: { userId, workspaceId: workspace.id, role: "MEMBER" },
      update: {},
    });

    return { ok: true };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("joinOrgWorkspaceAction", e);
    return { ok: false, error: "Failed to join organization. Please try again." };
  }
}
