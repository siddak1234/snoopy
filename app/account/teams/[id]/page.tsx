import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { PlatformServerError } from "@/lib/platform-server";
import {
  findAccessibleProject,
  listAccessRequests,
  listProjectMemberships,
  listWorkspaceMembers,
  type AccessRequest,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { ProjectMemberPicker } from "@/components/dashboard/ProjectMemberPicker";
import { ProjectMemberList } from "@/components/dashboard/ProjectMemberList";
import type { MemberRow } from "@/components/dashboard/ProjectMemberList";
import type { AvailableMember } from "@/components/dashboard/ProjectMemberPicker";
import { TeamAccessRequests } from "@/components/dashboard/TeamAccessRequests";

/** The requests, where the platform has them (404 before the SEVENTEENTH promotion). */
async function requestsIfThere(
  workspaceId: string,
  projectId: string,
): Promise<AccessRequest[]> {
  try {
    return await listAccessRequests(workspaceId, projectId);
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404) return [];
    throw error;
  }
}

/**
 * One team (BUILD-PLAN 24.11.11). Every action acts on the team's own
 * workspace, resolved on the server: a team can live in a workspace other than
 * the active one. In an organization a team has members, and — for those who
 * decide: its owner or admin, and the organization's — the people asking to
 * join. A personal workspace's team has only its owner. The owner deletes it
 * (archived: it leaves every team list, and its flows keep running until
 * archived in Flows); anyone else on it leaves. Its title is its kind, said
 * once (the owner, build 9: a team IS its kind).
 */
export default async function TeamDetailPage({
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
  const organization = workspace.type === "organization";
  const canManage =
    project.viewerRole === "owner" || project.viewerRole === "admin";
  const [memberships, workspaceMembers, requests] = await Promise.all([
    organization ? listProjectMemberships(workspace.id, project.id) : [],
    organization && canManage ? listWorkspaceMembers(workspace.id) : [],
    organization && canManage ? requestsIfThere(workspace.id, project.id) : [],
  ]);
  const owner = project.viewerRole === "owner";
  // An organization owner or admin sees every team without being on it; they
  // have nothing to leave.
  const onTeam =
    owner || memberships.some((member) => member.userId === session.user.id);
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
  const pending = requests.filter((request) => request.status === "pending");

  return (
    <SectionCard
      title={project.type}
      subheader={[
        workspace.type === "personal" ? "Personal" : workspace.name,
        onTeam
          ? `You are its ${project.viewerRole}`
          : "You see every team as an organization admin",
      ].join(" · ")}
      primaryAction={
        canManage && organization ? (
          <ProjectMemberPicker
            projectId={project.id}
            availableMembers={availableMembers}
          />
        ) : null
      }
      secondaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            prefetch={false}
            href="/account/teams"
            className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
          >
            Back to teams
          </Link>
          {owner ? (
            <DeleteProjectButton
              projectId={project.id}
              projectName={project.type}
              redirectAfterDelete="/account/teams"
            />
          ) : onTeam ? (
            <LeaveProjectButton
              projectId={project.id}
              projectName={project.type}
              redirectAfterLeave="/account/teams"
            />
          ) : null}
        </div>
      }
    >
      {project.description ? (
        <p className="pb-5 text-sm text-[var(--muted)]">
          {project.description}
        </p>
      ) : null}

      {organization ? (
        <div className="border-t border-[var(--ring)] py-5 first:pt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Members
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
            leaveRedirect="/account/teams"
          />
        </div>
      ) : null}

      {organization && canManage ? (
        <div className="border-t border-[var(--ring)] py-5 pb-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Asking to join
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {pending.length}
            </span>
          </div>
          <TeamAccessRequests projectId={project.id} requests={requests} />
        </div>
      ) : null}
    </SectionCard>
  );
}
