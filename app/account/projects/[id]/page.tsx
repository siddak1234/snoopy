import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  findAccessibleProject,
  listProjectMemberships,
  listWorkspaceMembers,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { ProjectMemberPicker } from "@/components/dashboard/ProjectMemberPicker";
import { ProjectMemberList } from "@/components/dashboard/ProjectMemberList";
import type { MemberRow } from "@/components/dashboard/ProjectMemberList";
import type { AvailableMember } from "@/components/dashboard/ProjectMemberPicker";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session) notFound();
  const { id } = await params;
  const context = await findAccessibleProject(id);
  if (!context) notFound();
  const { workspace, project } = context;
  const isTeamProject = workspace.type === "organization";
  const canManage =
    project.viewerRole === "owner" || project.viewerRole === "admin";
  const memberships = isTeamProject
    ? await listProjectMemberships(workspace.id, project.id)
    : [];
  const workspaceMembers = canManage
    ? await listWorkspaceMembers(workspace.id)
    : [];
  const memberIds = new Set(memberships.map((member) => member.userId));
  const availableMembers: AvailableMember[] = workspaceMembers
    .filter((member) => !memberIds.has(member.userId))
    .map((member) => ({
      userId: member.userId,
      name: member.displayName ?? null,
      email: member.email,
    }));
  const memberRows: MemberRow[] = memberships.map((member) => ({
    userId: member.userId,
    name: member.displayName ?? null,
    email: member.email,
    role: member.role,
    createdAt: member.createdAt,
  }));

  return (
    <SectionCard
      title={project.name}
      subheader={project.type || undefined}
      primaryAction={
        canManage && isTeamProject ? (
          <ProjectMemberPicker
            projectId={project.id}
            availableMembers={availableMembers}
          />
        ) : null
      }
      secondaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/account/projects"
            className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
          >
            Back to projects
          </Link>
          {project.viewerRole === "owner" ? (
            <DeleteProjectButton
              projectId={project.id}
              projectName={project.name}
              redirectAfterDelete="/account/projects"
            />
          ) : (
            <LeaveProjectButton
              projectId={project.id}
              projectName={project.name}
              redirectAfterLeave="/account/projects"
            />
          )}
        </div>
      }
    >
      {isTeamProject ? (
        <div className="border-t border-[var(--ring)] py-5 first:pt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Team
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {memberRows.length}{" "}
              {memberRows.length === 1 ? "member" : "members"}
            </span>
          </div>
          <ProjectMemberList
            projectId={project.id}
            viewerUserId={session.user.id}
            viewerRole={project.viewerRole}
            members={memberRows}
            leaveRedirect="/account/projects"
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
