import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { listWorkspaces } from "@/lib/tenancy";
import {
  DashboardSidebar,
  DashboardHeader,
} from "@/components/dashboard/DashboardNav";
import { AccountTopBar } from "@/components/dashboard/AccountTopBar";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();

  if (!session?.user?.email || !session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  // Session workspaces may be bounded, so use the public collection before
  // deciding that an organization membership is absent.
  const workspaces = await listWorkspaces();
  const showOrgSettings = workspaces.some(
    (workspace) =>
      workspace.type === "organization" && workspace.role === "owner",
  );

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
