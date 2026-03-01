import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
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
          <Link
            href={`/account/projects/${project.id}`}
            className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-3 transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
          >
            <span className="min-w-0 flex-1 font-medium text-[var(--text)]">
              {project.name}
            </span>
            <StatusPill status={project.status} />
            <span className="w-full text-sm text-[var(--muted)]">
              {project.description?.trim() ||
                new Date(project.createdAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
