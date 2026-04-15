import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { provisionUserFromSupabaseAuth } from "@/lib/auth-supabase";
import { classifyEmailDomain } from "@/lib/domain-utils";
import { ensureDefaultWorkspaceForUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// resolvePostSigninDestination
// ---------------------------------------------------------------------------
// Called from the auth callback route after a successful code exchange.
// Returns the path the user should be sent to.
//
// Returning users (who already have a Membership row) are sent straight to
// defaultNext — zero change to existing behaviour.
//
// New users are routed based on their email domain:
//   public consumer domain          → create personal workspace now, go to defaultNext
//   custom domain, no verified org  → /onboarding/setup-org
//   custom domain, unverified org   → treat as unclaimed (safer than routing into
//                                     another org's unfinished setup)
//   custom domain, verified org     → /onboarding/join-org?w={workspaceId}
// ---------------------------------------------------------------------------

export async function resolvePostSigninDestination(
  supabaseUser: SupabaseUser,
  defaultNext: string
): Promise<string> {
  // 1. Provision the app user row (idempotent upsert)
  const { id: userId } = await provisionUserFromSupabaseAuth(supabaseUser);

  // 2. Returning-user fast path — if they already have ANY workspace membership,
  //    send them straight to their intended destination.
  const existing = await prisma.membership.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  if (existing) return defaultNext;

  // 2b. Org-invite bypass — if the user is returning from a workspace invite link,
  //     skip onboarding classification entirely and send them back to the invite page.
  //     The invite page handles workspace joining without creating a personal workspace.
  if (defaultNext.startsWith("/org-invite/")) {
    return defaultNext;
  }

  // 3. New user — classify their email domain
  const email = supabaseUser.email ?? "";
  const result = await classifyEmailDomain(email);

  // Edge case: empty domain (malformed email) → fall back to personal workspace
  if (!result.domain) {
    await ensureDefaultWorkspaceForUser(userId);
    return defaultNext;
  }

  switch (result.classification) {
    case "public":
      // Consumer provider → personal workspace, no onboarding step
      await ensureDefaultWorkspaceForUser(userId);
      return defaultNext;

    case "custom_unclaimed":
    case "custom_claimed_unverified":
      // Custom domain but no verified org yet → offer to create one
      return "/onboarding/setup-org";

    case "custom_claimed_verified":
      // A verified org exists for this domain → offer to join
      return `/onboarding/join-org?w=${result.existingWorkspace!.id}`;
  }
}
