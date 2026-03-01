import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { DeleteProjectButton } from "./DeleteProjectButton";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  user: { name: string | null };
};

const statusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  archived: "Archived",
};

function StatusPill({ status }: { status: ProjectStatus }) {
  const variant =
    status === "active"
      ? "bg-[var(--chip-bg)] text-[var(--chip-text)]"
      : status === "paused"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : status === "draft"
          ? "bg-[var(--muted)]/20 text-[var(--muted)]"
          : "bg-[var(--ring)]/50 text-[var(--muted)]";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${variant}`}
    >
      {statusLabel[status]}
    </span>
  );
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-[var(--ring)]">
      {projects.map((project) => (
        <li key={project.id}>
          <div className="flex items-start gap-2 rounded-xl px-2 py-3 transition hover:bg-[var(--surface-hover)]">
            <Link
              href={`/account/projects/${project.id}`}
              className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset rounded-lg"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text)]">{project.name}</span>
                <StatusPill status={project.status} />
              </div>
              <span className="block text-sm text-[var(--muted)] mt-0.5">
                {project.description?.trim() ||
                  new Date(project.createdAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                {project.user?.name ? ` · Owner: ${project.user.name}` : null}
              </span>
            </Link>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
