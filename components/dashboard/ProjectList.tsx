import Link from "next/link";
import type { ProjectMemberRole, ProjectStatus, WorkspaceType } from "@prisma/client";
import { DeleteProjectButton } from "./DeleteProjectButton";

export type ProjectListItem = {
  id: string;
  name: string;
  status: ProjectStatus;
  type: string;
  ownerName: string | null;
  ownerEmail: string | null;
  viewerRole: ProjectMemberRole;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceType: WorkspaceType | null;
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
        ? "bg-[var(--warning-bg)] text-[var(--warning-text)]"
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

const roleLabel: Record<ProjectMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  project_user: "Member",
};

export function RolePill({ role }: { role: ProjectMemberRole }) {
  // Owner draws the eye to projects the viewer owns; admin/member share a
  // muted style so the list stays calm.
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

function ownerLabel(name: string | null, email: string | null): string {
  // Prefer email — the workspace section already shows the company / personal
  // workspace name, so name-only would just duplicate that label.
  return email?.trim() || name?.trim() || "Unknown";
}

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) return null;

  return (
    <ul className="divide-y divide-[var(--ring)]">
      {projects.map((project) => {
        const isOwner = project.viewerRole === "owner";
        return (
          <li key={project.id}>
            <div className="flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-[var(--surface-hover)]">
              <Link
                href={`/account/projects/${project.id}`}
                className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset rounded-lg"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--text)]">{project.name}</span>
                  <StatusPill status={project.status} />
                </div>
                {project.type.trim() ? (
                  <span className="block text-sm text-[var(--muted)] mt-0.5">
                    {project.type}
                  </span>
                ) : null}
                <span className="block text-sm text-[var(--muted)] mt-0.5">
                  Owner: {ownerLabel(project.ownerName, project.ownerEmail)}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <RolePill role={project.viewerRole} />
                {isOwner ? (
                  <DeleteProjectButton projectId={project.id} projectName={project.name} />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
