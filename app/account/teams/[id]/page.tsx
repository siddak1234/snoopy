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
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/dashboard/Group";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { GROUP_BAND, SPACING } from "@/lib/spacing";

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
          : "You see every department as an organization admin",
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
        <div className={`flex flex-wrap items-center ${SPACING.inner.gap}`}>
          <Button
            prefetch={false}
            href="/account/teams"
            variant="secondary"
            size="sm"
          >
            Back to departments
          </Button>
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
        <Group>
          <p className="text-sm text-[var(--muted)]">{project.description}</p>
        </Group>
      ) : null}

      {organization ? (
        // Each list keeps its own title gap: the band and its title only.
        <section className={GROUP_BAND}>
          <div className="flex items-center justify-between">
            <SectionTitle>Members</SectionTitle>
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
        </section>
      ) : null}

      {organization && canManage ? (
        <section className={GROUP_BAND}>
          <div className="flex items-center justify-between">
            <SectionTitle>Asking to join</SectionTitle>
            <span className="text-xs text-[var(--muted)]">
              {pending.length}
            </span>
          </div>
          <TeamAccessRequests projectId={project.id} requests={requests} />
        </section>
      ) : null}
    </SectionCard>
  );
}
