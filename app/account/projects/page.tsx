import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { ensureTenantForUser } from "@/lib/tenant";
import { getMyProjects, getTeamProjects, getUsedProjectTypesByScope } from "@/lib/projects";
import { prisma } from "@/lib/db";
import SectionCard from "@/components/dashboard/SectionCard";
import { ProjectList } from "@/components/dashboard/ProjectList";
import type { ProjectListItem } from "@/components/dashboard/ProjectList";
import { CreateProjectButton } from "@/components/dashboard/CreateProjectButton";
import { JoinProjectButton } from "@/components/dashboard/JoinProjectButton";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";
import { PROJECT_TYPES } from "@/lib/project-types";

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
  const [rawMyProjects, rawTeamProjects, usedTypesByScope, orgMembership] = await Promise.all([
    getMyProjects(session.user.id),
    getTeamProjects(session.user.id),
    getUsedProjectTypesByScope(session.user.id),
    prisma.membership.findFirst({
      where: { userId: session.user.id, workspace: { type: "organization" } },
      select: { workspaceId: true },
    }),
  ]);
  const hasOrg = orgMembership !== null;

  // ---------------------------------------------------------------------------
  // Shape into a single ProjectListItem stream. Owned projects always carry
  // viewerRole='owner'; team projects carry the role from the user's
  // projectMembership row. From here on the UI doesn't care about the split.
  // ---------------------------------------------------------------------------
  const ownedItems: ProjectListItem[] = rawMyProjects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    type: p.type,
    ownerName: p.ownerName ?? p.owner?.name ?? null,
    ownerEmail: p.owner?.email ?? null,
    viewerRole: "owner",
    workspaceId: p.workspaceId ?? null,
    workspaceName: p.workspace?.name ?? null,
    workspaceType: p.workspace?.type ?? null,
  }));

  const teamItems: ProjectListItem[] = rawTeamProjects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    type: p.type,
    ownerName: p.ownerName ?? p.owner?.name ?? null,
    ownerEmail: p.owner?.email ?? null,
    viewerRole: p.projectMemberships[0]?.role ?? "project_user",
    workspaceId: p.workspaceId ?? null,
    workspaceName: p.workspace?.name ?? null,
    workspaceType: p.workspace?.type ?? null,
  }));

  // ---------------------------------------------------------------------------
  // Group by workspace. createdAt order from the query is preserved across the
  // merge — owned and team items share the same list within a workspace.
  // ---------------------------------------------------------------------------
  type WorkspaceGroup = {
    workspaceId: string | null;
    workspaceName: string;
    workspaceType: "personal" | "organization" | null;
    items: ProjectListItem[];
  };
  const NO_WS = "__none__";
  const groupMap = new Map<string, WorkspaceGroup>();
  for (const item of [...ownedItems, ...teamItems]) {
    const key = item.workspaceId ?? NO_WS;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName ?? "Personal",
        workspaceType: item.workspaceType,
        items: [],
      });
    }
    groupMap.get(key)!.items.push(item);
  }
  const groups = Array.from(groupMap.values());

  const personalFull = usedTypesByScope.personal.length >= PROJECT_TYPES.length;
  const teamFull = usedTypesByScope.team.length >= PROJECT_TYPES.length;
  // Hide the Create button only when every available scope is full: both scopes
  // for org members, just personal for users with no org.
  const allScopesFull = hasOrg ? personalFull && teamFull : personalFull;

  return (
    <SectionCard
      title="Projects"
      subheader={
        groups.length > 1
          ? "Manage your projects across all organizations"
          : "Manage your projects"
      }
    >
      {/* Top-level controls: Create (scope-aware) + Join. */}
      <div className="flex flex-wrap items-center justify-end gap-2 py-3 first:pt-0">
        {allScopesFull ? (
          <p className="text-sm text-[var(--muted)]">All project types created.</p>
        ) : (
          <CreateProjectButton
            usedTypesByScope={usedTypesByScope}
            hasOrg={hasOrg}
          />
        )}
        {/* Personal users (no org membership) don't have a workspace to join
            into via this picker. Org-invite emails still work for them via
            /org-invite/[token] regardless of this button. */}
        {hasOrg ? <JoinProjectButton /> : null}
      </div>

      {groups.length === 0 ? (
        <div className="py-5">
          <p className="text-sm text-[var(--muted)]">No projects yet.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Create a project to get started, or join an organization to access team projects.
          </p>
        </div>
      ) : (
        groups.map((group, idx) => {
          const isOrg = group.workspaceType === "organization";
          return (
            <div
              key={group.workspaceId ?? NO_WS}
              className={idx === 0 ? "py-5 first:pt-0" : "border-t border-[var(--ring)] py-5"}
            >
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {isOrg ? `${group.workspaceName} Team Projects` : group.workspaceName}
              </h2>
              <div className="mt-3">
                <ProjectList projects={group.items} />
              </div>
            </div>
          );
        })
      )}
    </SectionCard>
  );
}
