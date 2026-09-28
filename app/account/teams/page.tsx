import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import {
  administers,
  listTeams,
  listWorkspaces,
  resolveActiveWorkspaceId,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { CreateTeamForm } from "./CreateTeamForm";

export const dynamic = "force-dynamic";

/**
 * Teams (backend ADR-0010, §12.1 #173). An owner or admin sees every team in
 * the organization and creates them; anyone else sees the teams they are on.
 * A team's manager may be a plain member of the workspace, which is why teams
 * have a page of their own rather than a section of the organization page,
 * which is for owners and admins.
 */
export default async function TeamsPage() {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  const workspace = (await listWorkspaces()).find(
    (entry) => entry.id === workspaceId,
  );

  if (!workspace || workspace.type !== "organization") {
    return (
      <SectionCard
        title="Teams"
        subheader="Groups of people in an organization"
      >
        <EmptyRow text="Teams belong to an organization workspace. Switch to one to see its teams." />
      </SectionCard>
    );
  }

  const canCreate = administers(workspace.role);
  const teams = await listTeams(workspace.id);

  return (
    <SectionCard
      title="Teams"
      subheader={
        canCreate ? "Every team in this organization" : "The teams you are on"
      }
    >
      {teams.length === 0 ? (
        <EmptyRow
          text={canCreate ? "No teams yet." : "You are not on a team yet."}
        />
      ) : (
        <ul className="divide-y divide-[var(--ring)]">
          {teams.map((team) => (
            <li key={team.id} className="py-3 first:pt-0">
              <Link
                prefetch={false}
                href={`/account/teams/${encodeURIComponent(team.id)}`}
                className="font-medium text-[var(--text)] underline-offset-2 hover:underline"
              >
                {team.name}
              </Link>
              {team.description ? (
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {team.description}
                </p>
              ) : null}
              {team.viewerRole ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  You are its {team.viewerRole}.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <div className="border-t border-[var(--ring)] py-5 pb-0">
          <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Create a team
          </h2>
          <CreateTeamForm />
        </div>
      ) : null}
    </SectionCard>
  );
}
