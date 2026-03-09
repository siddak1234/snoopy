import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultWorkspaceForUser } from "@/lib/auth";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    workspaceId?: string;
  };
};

/**
 * Provision or update User from Supabase Auth (OAuth or email/password).
 * Same logic as legacy provisionUser but keyed by supabaseUserId or email.
 */
async function provisionUserFromSupabaseAuth(supabaseUser: SupabaseUser): Promise<{ id: string }> {
  const { prisma } = await import("@/lib/db");
  const email = normalizeEmail(supabaseUser.email ?? "");
  const supabaseUserId = supabaseUser.id;
  const name =
    (supabaseUser.user_metadata?.full_name as string | null) ??
    (supabaseUser.user_metadata?.name as string | null) ??
    null;
  const image =
    (supabaseUser.user_metadata?.avatar_url as string | null) ??
    (supabaseUser.user_metadata?.picture as string | null) ??
    null;

  if (!email) return Promise.reject(new Error("User has no email"));

  const bySupabaseId = await prisma.user.findUnique({
    where: { supabaseUserId },
  });
  if (bySupabaseId) {
    await prisma.user.update({
      where: { id: bySupabaseId.id },
      data: { email, name, image },
    });
    return { id: bySupabaseId.id };
  }

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { supabaseUserId, name, image },
    });
    return { id: byEmail.id };
  }

  const created = await prisma.user.create({
    data: { email, supabaseUserId, name, image },
  });
  return { id: created.id };
}

/**
 * Get app session from Supabase Auth. Provisions user if needed, ensures workspace.
 * Returns same shape as legacy getServerSession for drop-in replacement.
 * All Supabase calls are awaited so we only return after confirmation from the server.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser?.email) return null;

  try {
    const { id } = await provisionUserFromSupabaseAuth(supabaseUser);
    const workspaceId = await ensureDefaultWorkspaceForUser(id);
    const name =
      (supabaseUser.user_metadata?.full_name as string | null) ??
      (supabaseUser.user_metadata?.name as string | null) ??
      null;

    return {
      user: {
        id,
        email: supabaseUser.email,
        name,
        workspaceId,
      },
    };
  } catch (err) {
    console.error("AUTH_SUPABASE_PROVISION_FAIL", (err as Error).message);
    return null;
  }
}
