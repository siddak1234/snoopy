import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import {
  getProjectForUser,
  getProjectMembers,
  getWorkspaceMembersNotInProject,
} from "@/lib/projects";
import { canUserPerform, getProjectRole } from "@/lib/project-rbac";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { ProjectMemberPicker } from "@/components/dashboard/ProjectMemberPicker";
import { ProjectMemberList } from "@/components/dashboard/ProjectMemberList";
import type { MemberRow } from "@/components/dashboard/ProjectMemberList";
import { GlCodeAllocationDashboard } from "@/components/dashboard/GlCodeAllocationDashboard";
import type { AvailableMember } from "@/components/dashboard/ProjectMemberPicker";

const GL_CODE_PROJECT_TYPE = "GL Code Classification";
const RESUME_REVIEWER_PROJECT_TYPE = "Resume Reviewer";

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
  const isTeamProject = project.workspace?.type === "organization";
  // Personal workspaces are solo by construction — no one else can be invited
  // to them — so the member picker is hidden for personal projects.
  const canAddMembers = (isOwner || isAdmin) && isTeamProject;
  const canDelete = isOwner;
  const canLeave = isMember && !isOwner;

  // Workspace members not yet in this project — feeds the Add team members picker modal.
  const availableRaw =
    canAddMembers && project.workspaceId
      ? await getWorkspaceMembersNotInProject(id, project.workspaceId)
      : [];

  const availableMembers: AvailableMember[] = availableRaw.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
  }));

  // Team member list. Personal projects are solo by design — skip the fetch
  // and the section. For team projects, gate visibility on project:view_members
  // (granted to owner / admin / member / project_user).
  const canViewMembers =
    isTeamProject && (await canUserPerform(userId, id, "project:view_members"));
  const memberRows: MemberRow[] = canViewMembers
    ? (await getProjectMembers(id)).map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      }))
    : [];

  return (
    <SectionCard
      title={project.name}
      subheader={project.type || undefined}
      primaryAction={
        canAddMembers ? (
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
      }
    >
      {project.type === GL_CODE_PROJECT_TYPE ? (
        <div className="py-5 first:pt-0">
          <GlCodeAllocationDashboard projectId={project.id} />
        </div>
      ) : null}

      {project.type === RESUME_REVIEWER_PROJECT_TYPE ? (
        <div className="py-5 first:pt-0">
          <div className="rounded-xl border border-[var(--ring)] bg-[var(--card)] px-5 py-8 text-center">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Resume Reviewer
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              This workspace is coming soon. You&apos;ll be able to upload
              resumes and get structured reviews here.
            </p>
          </div>
        </div>
      ) : null}

      {canViewMembers ? (
        <div className="py-5 first:pt-0 border-t border-[var(--ring)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Team
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {memberRows.length} {memberRows.length === 1 ? "member" : "members"}
            </span>
          </div>
          <ProjectMemberList
            projectId={project.id}
            viewerUserId={userId}
            viewerRole={role ?? "project_user"}
            members={memberRows}
            leaveRedirect="/account/projects"
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
