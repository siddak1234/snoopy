import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { listAccessibleProjects } from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { ProjectList } from "@/components/dashboard/ProjectList";
import type { ProjectListItem } from "@/components/dashboard/ProjectList";
import { CreateProjectButton } from "@/components/dashboard/CreateProjectButton";

export default async function AccountProjectsPage() {
  const session = await getAppSession();
  if (!session) redirect("/login?callbackUrl=/account/projects");

  const accessible = await listAccessibleProjects();
  const items = accessible
    .filter(({ project }) => project.status !== "archived")
    .map<ProjectListItem>(({ workspace, project }) => ({
      ...project,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
    }));
  const groups = Array.from(
    items.reduce((map, item) => {
      const current = map.get(item.workspaceId) ?? {
        workspaceName: item.workspaceName,
        workspaceType: item.workspaceType,
        items: [],
      };
      current.items.push(item);
      map.set(item.workspaceId, current);
      return map;
    }, new Map<string, { workspaceName: string; workspaceType: "personal" | "organization"; items: ProjectListItem[] }>()),
  );
  const hasOrg = accessible.some(
    ({ workspace }) => workspace.type === "organization",
  );

  return (
    <SectionCard
      title="Projects"
      subheader={
        groups.length > 1
          ? "Manage your projects across all organizations"
          : "Manage your projects"
      }
    >
      <div className="flex flex-wrap items-center justify-end gap-2 py-3 first:pt-0">
        <CreateProjectButton hasOrg={hasOrg} />
      </div>

      {groups.length === 0 ? (
        <div className="py-5">
          <p className="text-sm text-[var(--muted)]">No projects yet.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Create a project to get started, or join an organization to access
            team projects.
          </p>
        </div>
      ) : (
        groups.map(([workspaceId, group], index) => (
          <div
            key={workspaceId}
            className={
              index === 0
                ? "py-5 first:pt-0"
                : "border-t border-[var(--ring)] py-5"
            }
          >
            <h2 className="text-sm font-medium text-[var(--text)]">
              {group.workspaceType === "organization"
                ? `${group.workspaceName} Team Projects`
                : group.workspaceName}
            </h2>
            <div className="mt-3">
              <ProjectList projects={group.items} />
            </div>
          </div>
        ))
      )}
    </SectionCard>
  );
}
