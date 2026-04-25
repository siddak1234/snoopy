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
import { GlCodeAllocationDashboard } from "@/components/dashboard/GlCodeAllocationDashboard";
import type { MemberRow } from "@/components/dashboard/ProjectMemberList";
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
          <Link href="/account/projects" className="btn-secondary inline-flex px-5">
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
      {/* ── GL Code Allocation dashboard (only for that project type) ────── */}
      {project.type === GL_CODE_PROJECT_TYPE ? (
        <div className="py-5 first:pt-0">
          <GlCodeAllocationDashboard />
        </div>
      ) : null}

      {/* ── Member management (owner and admin) ──────────────────────────── */}
      {canViewMembers && role ? (
        <div className="py-5 first:pt-0">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Team members
          </h3>
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
