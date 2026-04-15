import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { provisionUserFromSupabaseAuth } from "@/lib/auth-supabase";

/**
 * Onboarding layout — two guards:
 *
 * 1. Auth guard: unauthenticated users are sent to /login.
 *    (Middleware already does this, but we double-check here because the layout
 *    needs the userId anyway.)
 *
 * 2. Workspace guard: if the user already has a Membership row they have
 *    completed onboarding (or were a pre-existing user). Send them to /account
 *    so they never see onboarding pages again — including via browser back-button.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { id: userId } = await provisionUserFromSupabaseAuth(user);

  // Only redirect if the user already has an org workspace — a pre-existing
  // personal workspace must not block org creation/joining.
  const existing = await prisma.membership.findFirst({
    where: { userId, workspace: { type: "organization" } },
    select: { workspaceId: true },
  });

  if (existing) redirect("/account");

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {children}
    </div>
  );
}
