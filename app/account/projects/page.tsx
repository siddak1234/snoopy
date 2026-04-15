import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { ensureTenantForUser } from "@/lib/tenant";
import { getMyProjects, getTeamProjects } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { ProjectList, TeamProjectList } from "@/components/dashboard/ProjectList";
import type { MyProjectItem, TeamProjectItem } from "@/components/dashboard/ProjectList";
import { CreateProjectButton } from "@/components/dashboard/CreateProjectButton";
import { JoinProjectButton } from "@/components/dashboard/JoinProjectButton";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";

export default async function AccountProjectsPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    const cookieStore = await cookies();
    const hasSupabaseAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token"));
    if (hasSupabaseAuthCookies) {
      return <AuthHydrationGate destination="/account/projects" />;
    }
    redirect("/login?callbackUrl=/account/projects");
  }

  await ensureTenantForUser(session.user.id);
  const [rawMyProjects, rawTeamProjects] = await Promise.all([
    getMyProjects(session.user.id),
    getTeamProjects(session.user.id),
  ]);

  // ---------------------------------------------------------------------------
  // Shape data into typed items
  // ---------------------------------------------------------------------------
  const myProjects: MyProjectItem[] = rawMyProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    ownerName: p.ownerName,
    workspaceId: p.workspaceId ?? null,
    workspaceName: p.workspace?.name ?? null,
  }));

  const teamProjects: TeamProjectItem[] = rawTeamProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    ownerName: p.ownerName,
    projectMemberships: p.projectMemberships,
    workspaceId: p.workspaceId ?? null,
    workspaceName: p.workspace?.name ?? null,
  }));

  // ---------------------------------------------------------------------------
  // Determine if multi-workspace and build grouped structure
  // ---------------------------------------------------------------------------
  type WorkspaceGroup = {
    workspaceId: string | null;
    workspaceName: string;
    owned: MyProjectItem[];
    team: TeamProjectItem[];
  };

  const groupMap = new Map<string, WorkspaceGroup>();
  const NO_WS = "__none__";

  for (const p of myProjects) {
    const key = p.workspaceId ?? NO_WS;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        workspaceId: p.workspaceId ?? null,
        workspaceName: p.workspaceName ?? "Personal",
        owned: [],
        team: [],
      });
    }
    groupMap.get(key)!.owned.push(p);
  }
  for (const p of teamProjects) {
    const key = p.workspaceId ?? NO_WS;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        workspaceId: p.workspaceId ?? null,
        workspaceName: p.workspaceName ?? "Personal",
        owned: [],
        team: [],
      });
    }
    groupMap.get(key)!.team.push(p);
  }

  const groups = Array.from(groupMap.values());
  const isMultiWorkspace = groups.length > 1;

  // ---------------------------------------------------------------------------
  // Render: single workspace — identical layout to before
  // ---------------------------------------------------------------------------
  if (!isMultiWorkspace) {
    return (
      <SectionCard
        title="Projects"
        subheader="Manage your projects"
      >
        <div className="py-5 first:pt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              My projects
            </h2>
            <CreateProjectButton
              workspaceId={groups[0]?.workspaceId ?? undefined}
            />
          </div>
          {myProjects.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-[var(--muted)]">No projects yet.</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Create a project to get started, or join one with an access code.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <ProjectList projects={myProjects} />
            </div>
          )}
        </div>

        <div className="py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Team projects
            </h2>
            <JoinProjectButton />
          </div>
          {teamProjects.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-[var(--muted)]">You haven&apos;t joined any team projects yet.</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Ask your organization owner for an invite link, then use &ldquo;Join organization&rdquo;.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <TeamProjectList projects={teamProjects} />
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: multi-workspace — grouped by organization
  // ---------------------------------------------------------------------------
  return (
    <SectionCard
      title="Projects"
      subheader="Manage your projects across all organizations"
    >
      {/* Join button sits at the top level, applies to all workspaces */}
      <div className="flex justify-end py-3 first:pt-0">
        <JoinProjectButton />
      </div>

      {groups.map((group, idx) => (
        <div
          key={group.workspaceId ?? NO_WS}
          className={idx === 0 ? "py-5 first:pt-0" : "border-t border-[var(--ring)] py-5"}
        >
          {/* Workspace heading + create button */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {group.workspaceName}
            </h2>
            {group.workspaceId ? (
              <CreateProjectButton workspaceId={group.workspaceId} />
            ) : null}
          </div>

          {/* Owned projects */}
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              My projects
            </h3>
            {group.owned.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No owned projects in this organization.</p>
            ) : (
              <div className="mt-2">
                <ProjectList projects={group.owned} />
              </div>
            )}
          </div>

          {/* Team projects */}
          {group.team.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Team projects
              </h3>
              <div className="mt-2">
                <TeamProjectList projects={group.team} />
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </SectionCard>
  );
}
