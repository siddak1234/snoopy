import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getTenantForUser } from "@/lib/tenant";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
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
  const project = await getProjectForUser(id, session.user.id);

  if (!project) {
    notFound();
  }

  const tenant = await getTenantForUser(session.user.id);
  const isOwner =
    project.ownerUserId === session.user.id || project.userId === session.user.id;
  const isOrgOwner = tenant?.role === "org_owner";
  const canDelete = isOwner || isOrgOwner;
  const isMember = project.projectMemberships?.length > 0;
  const canLeave = !isOwner && isMember;

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
      <div className="py-5 first:pt-0">
        <dl className="grid gap-2 text-sm">
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
        </dl>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Project settings and workflow links will go here.
        </p>
      </div>
    </SectionCard>
  );
}
