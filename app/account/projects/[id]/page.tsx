import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  administers,
  findAccessibleProject,
  listProjectMemberships,
  listProjectTeamGrants,
  listTeams,
  listWorkspaceMembers,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { LeaveProjectButton } from "@/components/dashboard/LeaveProjectButton";
import { ProjectMemberPicker } from "@/components/dashboard/ProjectMemberPicker";
import { ProjectMemberList } from "@/components/dashboard/ProjectMemberList";
import type { MemberRow } from "@/components/dashboard/ProjectMemberList";
import type { AvailableMember } from "@/components/dashboard/ProjectMemberPicker";
import { ProjectTeamGrantForm } from "./ProjectTeamGrantForm";

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
  // Teams exist only in an organization. Anyone with a role on the project
  // reads its grants; the names come from the teams this person may see, so a
  // team they are not on reads as one (backend ADR-0010).
  const [memberships, grants, teams] = isTeamProject
    ? await Promise.all([
        listProjectMemberships(workspace.id, project.id),
        listProjectTeamGrants(workspace.id, project.id),
        listTeams(workspace.id),
      ])
    : [[], [], []];
  const teamName = new Map(teams.map((team) => [team.id, team.name]));
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
            prefetch={false}
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

      {isTeamProject ? (
        <div className="border-t border-[var(--ring)] py-5 pb-0">
          <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Teams with access
          </h2>
          {grants.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No team has access to this project.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--ring)]">
              {grants.map((grant) => (
                <li
                  key={grant.teamId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="text-sm font-medium text-[var(--text)]">
                    {teamName.get(grant.teamId) ?? "A team you are not on"}
                  </span>
                  <span className="text-xs text-[var(--muted)] capitalize">
                    {grant.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage && teams.length > 0 ? (
            <ProjectTeamGrantForm
              projectId={project.id}
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            />
          ) : null}
          {canManage && teams.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {administers(workspace.role) ? (
                <>
                  This organization has no teams yet. Teams are made on the{" "}
                  <Link
                    href="/account/teams"
                    prefetch={false}
                    className="text-[var(--accent)] underline underline-offset-2"
                  >
                    Teams page
                  </Link>
                  .
                </>
              ) : (
                <>
                  You can give access to a team you can see — the teams you are
                  on. The organization&apos;s owners and admins see every team.
                </>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
