import { redirect } from "next/navigation";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { getAppSession } from "@/lib/app-session";
import { loginHref } from "@/lib/platform-api";
import { PlatformServerError } from "@/lib/platform-server";
import {
  administers,
  listTeamDirectory,
  listWorkspaceProjects,
  listWorkspaces,
  resolveActiveWorkspaceId,
  type TeamDirectoryEntry,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { ProjectList } from "@/components/dashboard/ProjectList";
import type { ProjectListItem } from "@/components/dashboard/ProjectList";
import { CreateTeamButton } from "@/components/dashboard/CreateTeamButton";
import { AskToJoinList } from "@/components/dashboard/AskToJoinList";

/**
 * The directory, where the platform has one. A platform from before the
 * SEVENTEENTH promotion answers 404 for it: then the teams this person is on
 * are still listed and the asking section is simply not drawn, rather than the
 * whole page failing on the part that is not there yet.
 */
async function directoryIfThere(
  workspaceId: string,
): Promise<TeamDirectoryEntry[]> {
  try {
    return await listTeamDirectory(workspaceId);
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404) return [];
    throw error;
  }
}

/**
 * Teams (BUILD-PLAN 24.11.11). A team is a sub-organization with its own flows
 * — a project, in the platform's contract. Every team this person is on, in
 * every workspace they are in, grouped by workspace (an organization's owners
 * and admins see all of its teams); Create a team; and, in each organization,
 * the teams they could ask to join. A deleted (archived) team is not listed.
 *
 * A team is created in the workspace being worked in — the active one, a
 * personal workspace included — and, in an organization, only by its owners
 * and admins (the owner, build 9). In a personal workspace its owner is the
 * only member, so the one rule covers both: a plain member is offered no
 * Create, as the platform would refuse it (register F8).
 */
export default async function AccountTeamsPage() {
  const session = await getAppSession();
  if (!session) redirect(loginHref("/account/teams"));

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspaces(),
    resolveActiveWorkspaceId(session),
  ]);
  const active = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );
  const create =
    active && administers(active.role) ? (
      <CreateTeamButton
        workspace={{ id: active.id, name: active.name, type: active.type }}
      />
    ) : null;
  const groups = await Promise.all(
    workspaces.map(async (workspace) => {
      const [visible, directory] = await Promise.all([
        listWorkspaceProjects(workspace.id),
        workspace.type === "organization"
          ? directoryIfThere(workspace.id)
          : Promise.resolve([]),
      ]);
      const mine = visible
        .filter((project) => project.status !== "archived")
        .map<ProjectListItem>((project) => ({
          ...project,
          workspaceName: workspace.name,
          workspaceType: workspace.type,
        }));
      const onIt = new Set(mine.map((project) => project.id));
      const askable = directory.filter(
        (entry) => entry.access !== "member" && !onIt.has(entry.id),
      );
      return { workspace, mine, askable };
    }),
  );
  const shown = groups.filter(
    (group) => group.mine.length > 0 || group.askable.length > 0,
  );
  const organizations = workspaces.filter(
    (workspace) => workspace.type === "organization",
  ).length;

  return (
    <SectionCard
      title="Teams"
      subheader={
        organizations > 1
          ? "Your teams across all organizations"
          : "Your teams, and the ones you can ask to join"
      }
    >
      {/* The empty screen carries Create itself: one button, never two. */}
      {create && shown.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2 py-3 first:pt-0">
          {create}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <EmptyRow
          icon={<UsersThreeIcon size={32} />}
          title="No teams yet"
          text="A team has its own flows and its own people."
          action={create}
        />
      ) : (
        shown.map(({ workspace, mine, askable }, index) => {
          const askHeadingId = `ask-to-join-${workspace.id}`;
          return (
            <div
              key={workspace.id}
              className={
                index === 0
                  ? "py-5 first:pt-0"
                  : "border-t border-[var(--ring)] py-5"
              }
            >
              <h2 className="text-sm font-medium text-[var(--text)]">
                {workspace.type === "personal" ? "Personal" : workspace.name}
              </h2>
              <div className="mt-3">
                {mine.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    You are not on a team here yet.
                  </p>
                ) : (
                  <ProjectList projects={mine} />
                )}
              </div>
              {askable.length > 0 ? (
                <div className="mt-5">
                  <h3
                    id={askHeadingId}
                    tabIndex={-1}
                    className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase focus:outline-none"
                  >
                    Ask to join
                  </h3>
                  <AskToJoinList
                    workspaceId={workspace.id}
                    headingId={askHeadingId}
                    entries={askable}
                  />
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </SectionCard>
  );
}
