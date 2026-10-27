import { redirect } from "next/navigation";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { getAppSession } from "@/lib/app-session";
import { loginHref } from "@/lib/platform-api";
import {
  listWorkspaceProjects,
  listWorkspaces,
  teamDirectoryIfThere,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { ProjectList } from "@/components/dashboard/ProjectList";
import type { ProjectListItem } from "@/components/dashboard/ProjectList";
import { AskToJoinList } from "@/components/dashboard/AskToJoinList";

/**
 * Teams (BUILD-PLAN 24.11.11). A team is a sub-organization with its own flows
 * — a project, in the platform's contract. Every team this person is on, in
 * every workspace they are in, grouped by workspace (an organization's owners
 * and admins see all of its teams); and, in each organization, the teams they
 * could ask to join. A deleted (archived) team is not listed.
 *
 * No one creates a team here (backend ADR-0036; the owner, 2026-10-14: "theres
 * no choose a team. there will be pre existing teams depending on which flows
 * are added"): a flow goes to the team of its category, which the platform
 * makes the first time a flow of that category is added.
 */
export default async function AccountTeamsPage() {
  const session = await getAppSession();
  if (!session) redirect(loginHref("/account/teams"));

  const workspaces = await listWorkspaces();
  const groups = await Promise.all(
    workspaces.map(async (workspace) => {
      const [visible, directory] = await Promise.all([
        listWorkspaceProjects(workspace.id),
        workspace.type === "organization"
          ? teamDirectoryIfThere(workspace.id)
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
      title="Departments"
      subheader={
        organizations > 1
          ? "Your departments across all organizations"
          : "Your departments, and the ones you can ask to join"
      }
    >
      {shown.length === 0 ? (
        <EmptyRow
          icon={<UsersThreeIcon size={32} />}
          title="No departments yet"
          text="A department has its own flows and its own people."
        />
      ) : (
        shown.map(({ workspace, mine, askable }, index) => {
          const askHeadingId = `ask-to-join-${workspace.id}`;
          return (
            <div
              key={workspace.id}
              className={
                index === 0
                  ? "py-4 first:pt-0"
                  : "border-t border-[var(--ring)] py-4"
              }
            >
              <h2 className="text-sm font-medium text-[var(--text)]">
                {workspace.type === "personal" ? "Personal" : workspace.name}
              </h2>
              <div className="mt-2">
                {mine.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    You are not in a department here yet.
                  </p>
                ) : (
                  <ProjectList projects={mine} />
                )}
              </div>
              {askable.length > 0 ? (
                <div className="mt-4">
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
