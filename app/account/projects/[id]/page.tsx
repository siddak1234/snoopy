import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser, getProjectMembers, getWorkspaceMembersNotInProject } from "@/lib/projects";
import { getProjectRole } from "@/lib/project-rbac";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { ProjectMemberPicker } from "@/components/dashboard/ProjectMemberPicker";
import { ProjectMemberList } from "@/components/dashboard/ProjectMemberList";
import { formatDateMediumUTC } from "@/lib/date";
import type { MemberRow } from "@/components/dashboard/ProjectMemberList";
import type { AvailableMember } from "@/components/dashboard/ProjectMemberPicker";

const statusLabel: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  archived: "Archived",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    notFound();
  }

  const { id } = await params;
  const userId = session.user.id;

  const [project, role] = await Promise.all([
    getProjectForUser(id, userId),
    getProjectRole(userId, id),
  ]);

  if (!project) notFound();

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isMember = role !== null;
  const canViewMembers = isOwner || isAdmin;
  const canAddMembers = isOwner || isAdmin;
  const canDelete = isOwner;
  const canLeave = isMember && !isOwner;

  // Fetch member data only for users who can view the member section
  const [membersRaw, availableRaw] = canViewMembers
    ? await Promise.all([
        getProjectMembers(id),
        canAddMembers && project.workspaceId
          ? getWorkspaceMembersNotInProject(id, project.workspaceId)
          : Promise.resolve([]),
      ])
    : [[], []];

  // Serialize Dates for client component props
  const members: MemberRow[] = membersRaw.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
  }));

  const availableMembers: AvailableMember[] = availableRaw.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
  }));

  return (
    <SectionCard
      title={project.name}
      subheader={project.description ?? undefined}
      primaryAction={
        <Link href="/account/projects" className="btn-secondary inline-flex px-5">
          Back to projects
        </Link>
      }
      secondaryAction={
        canDelete || canLeave ? (
          <div className="flex flex-wrap items-center gap-2">
            {canDelete ? (
              <DeleteProjectButton
                projectId={project.id}
                projectName={project.name}
                redirectAfterDelete="/account/projects"
              />
            ) : null}
            {canLeave ? (
              <LeaveProjectButton
                projectId={project.id}
                projectName={project.name}
                redirectAfterLeave="/account/projects"
              />
            ) : null}
          </div>
        ) : null
      }
    >
      {/* ── Project metadata ─────────────────────────────────────────────── */}
      <div className="py-5 first:pt-0">
        <dl className="grid gap-2 text-sm">
          {project.type ? (
            <>
              <dt className="text-[var(--muted)]">Type</dt>
              <dd className="text-[var(--text)]">{project.type}</dd>
            </>
          ) : null}
          <dt className="text-[var(--muted)]">Status</dt>
          <dd>
            <span className="inline-flex rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)]">
              {statusLabel[project.status] ?? project.status}
            </span>
          </dd>
          <dt className="text-[var(--muted)]">Created</dt>
          <dd className="text-[var(--text)]">
            {formatDateMediumUTC(project.createdAt)}
          </dd>
          {!isOwner && project.ownerName ? (
            <>
              <dt className="text-[var(--muted)]">Owner</dt>
              <dd className="text-[var(--text)]">{project.ownerName}</dd>
            </>
          ) : null}
        </dl>
      </div>

      {/* ── Member management (owner and admin) ──────────────────────────── */}
      {canViewMembers && role ? (
        <div className="border-t border-[var(--ring)] py-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Team members
            </h3>
            {canAddMembers ? (
              <ProjectMemberPicker
                projectId={project.id}
                availableMembers={availableMembers}
              />
            ) : null}
          </div>

          <ProjectMemberList
            projectId={project.id}
            viewerUserId={userId}
            viewerRole={role}
            members={members}
            leaveRedirect="/account/projects"
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
