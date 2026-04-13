import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser, getProjectMembers } from "@/lib/projects";
import { getProjectRole } from "@/lib/project-rbac";
import { listPendingInvites } from "@/lib/invites";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { InviteSection } from "@/components/dashboard/InviteSection";
import { formatDateMediumUTC } from "@/lib/date";

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

  const isOwner  = role === "owner";
  const isMember = role !== null;
  const canDelete = isOwner;
  const canLeave  = isMember && !isOwner;

  // Parallel fetch of owner-only data
  const [members, pendingInvites] = isOwner
    ? await Promise.all([
        getProjectMembers(id),
        listPendingInvites(id, userId),
      ])
    : [[], []];

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

      {/* ── Members + invite management (owner only) ─────────────────────── */}
      {isOwner ? (
        <div className="border-t border-[var(--ring)] py-5">
          <InviteSection
            projectId={project.id}
            initialPendingInvites={pendingInvites.map((inv) => ({
              id: inv.id,
              token: inv.token,
              expiresAt: inv.expiresAt,
              createdAt: inv.createdAt,
            }))}
            initialMembers={members.map((m) => ({
              id: m.id,
              role: m.role,
              createdAt: m.createdAt,
              user: m.user,
            }))}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
