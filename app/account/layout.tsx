import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/db";
import {
  DashboardSidebar,
  DashboardHeader,
} from "@/components/dashboard/DashboardNav";
import { AccountTopBar } from "@/components/dashboard/AccountTopBar";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();

  if (!session?.user?.email || !session?.user?.id) {
    const cookieStore = await cookies();
    const hasSupabaseAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token"));

    if (hasSupabaseAuthCookies) {
      return <AuthHydrationGate destination="/account" />;
    }

    redirect("/login?callbackUrl=/account");
  }

  // Determine whether to show the Organization link in the sidebar.
  // Check all memberships — the session workspaceId may be a personal workspace
  // even when the user is also OWNER of an org workspace.
  const { id: userId } = session.user;
  const orgOwnerMembership = await prisma.membership.findFirst({
    where: { userId, role: "OWNER", workspace: { type: "organization" } },
    select: { workspaceId: true },
  });
  const showOrgSettings = !!orgOwnerMembership;

  return (
    // Self-contained dashboard shell: the route-group split means no marketing
    // header/container wraps this tree anymore, so it owns its own top bar and
    // horizontal padding.
    <div className="min-h-screen px-4 pb-6 md:px-6">
      <AccountTopBar />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <DashboardSidebar showOrgSettings={showOrgSettings} />
        <div className="min-w-0 flex-1">
          <header className="mb-4 lg:mb-0">
            <DashboardHeader showOrgSettings={showOrgSettings} />
          </header>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
