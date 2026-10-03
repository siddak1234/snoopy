import Link from "next/link";
import type { Project, ProjectStatus, Workspace } from "@/lib/tenancy";
import { DeleteProjectButton } from "./DeleteProjectButton";
import { StatusPill } from "./StatusPill";

export type ProjectListItem = Project & {
  workspaceName: Workspace["name"];
  workspaceType: Workspace["type"];
};

const roleLabel: Record<Project["viewerRole"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function RolePill({ role }: { role: Project["viewerRole"] }) {
  const variant =
    role === "owner"
      ? "bg-[var(--accent-strong)]/15 text-[var(--accent-strong)]"
      : "bg-[var(--muted)]/15 text-[var(--muted)]";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${variant}`}
    >
      {roleLabel[role]}
    </span>
  );
}

/**
 * The teams a person is on. A team's title is its kind (the owner, build 9: a
 * team IS its kind), printed once — a team made before that keeps a separate
 * name in the platform, which is not shown.
 */
export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) return null;
  return (
    <ul className="divide-y divide-[var(--ring)]">
      {projects.map((project) => (
        <li key={project.id}>
          <div className="flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-[var(--surface-hover)]">
            <Link
              prefetch={false}
              href={`/account/teams/${project.id}`}
              className="min-w-0 flex-1 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text)]">
                  {project.type}
                </span>
                <StatusPill status={project.status as ProjectStatus} />
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <RolePill role={project.viewerRole} />
              {project.viewerRole === "owner" ? (
                <DeleteProjectButton
                  projectId={project.id}
                  projectName={project.type}
                />
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
