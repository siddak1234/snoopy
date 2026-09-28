import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  administers,
  listTeamMemberships,
  listTeams,
  listWorkspaceMembers,
  listWorkspaces,
  resolveActiveWorkspaceId,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { ConfirmRemoveButton } from "@/components/dashboard/ConfirmRemoveButton";
import { removeTeamMemberAction } from "../actions";
import { TeamMemberForm } from "./TeamMemberForm";

export const dynamic = "force-dynamic";

/**
 * One team. Who is on it is read by an owner, an admin or the team's manager —
 * the platform refuses anyone else — and names are joined from the workspace's
 * member list, because the membership carries only an id.
 */
export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  const workspace = (await listWorkspaces()).find(
    (entry) => entry.id === workspaceId,
  );
  if (!workspace || workspace.type !== "organization") notFound();
  // A team the person may not see is absent from their list: not found, as
  // the platform answers it.
  const team = (await listTeams(workspace.id)).find(
    (entry) => entry.id === teamId,
  );
  if (!team) notFound();

  const canManage =
    administers(workspace.role) || team.viewerRole === "manager";
  const [memberships, workspaceMembers] = canManage
    ? await Promise.all([
        listTeamMemberships(workspace.id, team.id),
        listWorkspaceMembers(workspace.id),
      ])
    : [[], []];
  const person = new Map(
    workspaceMembers.map((member) => [member.userId, member]),
  );
  const label = (userId: string) => {
    const member = person.get(userId);
    return member?.displayName ?? member?.email ?? "A former member";
  };

  return (
    <SectionCard
      title={team.name}
      subheader={team.description || undefined}
      secondaryAction={
        <Link
          prefetch={false}
          href="/account/teams"
          className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
        >
          Back to teams
        </Link>
      }
    >
      {canManage ? (
        <>
          <div className="py-5 first:pt-0">
            <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Members
            </h2>
            {memberships.length === 0 ? (
              <EmptyRow text="No one is on this team yet." />
            ) : (
              <ul className="mt-3 divide-y divide-[var(--ring)]">
                {memberships.map((membership) => (
                  <li
                    key={membership.userId}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {label(membership.userId)}
                      </p>
                      {person.get(membership.userId)?.displayName ? (
                        <p className="truncate text-xs text-[var(--muted)]">
                          {person.get(membership.userId)?.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)] capitalize">
                        {membership.role}
                      </span>
                      <ConfirmRemoveButton
                        label="Remove"
                        busyLabel="Removing…"
                        title={`Remove ${label(membership.userId)} from ${team.name}?`}
                        description="They lose any project access the team gave them. You can add them again."
                        confirmLabel="Remove"
                        action={removeTeamMemberAction.bind(
                          null,
                          workspace.id,
                          team.id,
                          membership.userId,
                        )}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-[var(--ring)] py-5 pb-0">
            <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Add someone, or change their role
            </h2>
            <TeamMemberForm
              workspaceId={workspace.id}
              teamId={team.id}
              people={workspaceMembers.map((member) => ({
                userId: member.userId,
                label: member.displayName
                  ? `${member.displayName} (${member.email})`
                  : member.email,
              }))}
            />
          </div>
        </>
      ) : (
        <EmptyRow text="Only this team's managers, and the organization's owners and admins, can see who is on it." />
      )}
    </SectionCard>
  );
}
