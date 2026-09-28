import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { loginHref } from "@/lib/platform-api";
import { PlatformServerError } from "@/lib/platform-server";
import { PlatformUnavailable } from "@/components/dashboard/PlatformUnavailable";
import {
  administers,
  listWorkspaces,
  resolveActiveWorkspaceId,
} from "@/lib/tenancy";
import {
  DashboardSidebar,
  DashboardHeader,
} from "@/components/dashboard/DashboardNav";
import { AccountTopBar } from "@/components/dashboard/AccountTopBar";

const SIGN_IN = loginHref("/account");

/** What the shell needs, or `null` when there is no session. */
async function readAccountShell() {
  const session = await getAppSession();
  if (!session?.user?.email || !session?.user?.id) return null;
  // Session workspaces may be bounded, so use the public collection before
  // deciding that an organization membership is absent.
  const workspaces = await listWorkspaces();
  const activeWorkspaceId = await resolveActiveWorkspaceId(session);
  return { workspaces, activeWorkspaceId };
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // **A refusal is not a sign-out — backend §12.1 #160.** Only "no session" goes
  // to `/login`: the session read's `null`, or a 401 from a later read because
  // it ended in between. A 429 or a failed read renders here instead, because no
  // error boundary wraps the layout of its own segment.
  let shell: Awaited<ReturnType<typeof readAccountShell>>;
  try {
    shell = await readAccountShell();
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 401) redirect(SIGN_IN);
    return (
      <PlatformUnavailable
        busy={error.status === 429}
        retryAfterSeconds={error.retryAfterSeconds}
      />
    );
  }
  if (!shell) redirect(SIGN_IN);

  const { workspaces, activeWorkspaceId } = shell;
  // Each organization link shows where its page renders: the organization page
  // for the active organization's owners and admins — who may do everything on
  // it (register F55) — and teams in any organization workspace.
  const active = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );
  const inOrganization = active?.type === "organization";
  const showOrgSettings = inOrganization && administers(active?.role);
  const showTeams = inOrganization;

  return (
    // Self-contained dashboard shell: the route-group split means no marketing
    // header/container wraps this tree anymore, so it owns its own top bar and
    // horizontal padding.
    <div className="min-h-screen px-4 pb-6 md:px-6">
      <AccountTopBar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <DashboardSidebar
          showOrgSettings={showOrgSettings}
          showTeams={showTeams}
        />
        <div className="min-w-0 flex-1">
          <header className="mb-4 lg:mb-0">
            <DashboardHeader
              showOrgSettings={showOrgSettings}
              showTeams={showTeams}
            />
          </header>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
