import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser, getWorkspaceMembersNotInProject } from "@/lib/projects";
import { getProjectRole } from "@/lib/project-rbac";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { ProjectMemberPicker } from "@/components/dashboard/ProjectMemberPicker";
import { GlCodeAllocationDashboard } from "@/components/dashboard/GlCodeAllocationDashboard";
import type { AvailableMember } from "@/components/dashboard/ProjectMemberPicker";

const GL_CODE_PROJECT_TYPE = "GL Code Classification";

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
  const canAddMembers = isOwner || isAdmin;
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
          <GlCodeAllocationDashboard />
        </div>
      ) : null}
    </SectionCard>
  );
}
