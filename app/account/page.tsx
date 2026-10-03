import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import {
  formatWhen,
  listAutomations,
  listRuns,
  listSubscriptions,
  readRunStats,
} from "@/lib/automations";
import { listConnections } from "@/lib/connections";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
} from "@/lib/platform-server";
import {
  administers,
  listAccessibleProjects,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { StatusPill } from "@/components/dashboard/StatusPill";

/** The first instant of this month, UTC — the zone every date on these pages is in. */
function startOfMonthUtc(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

/**
 * The workspace's own numbers, read from the platform rather than printed as
 * zeros (register F54). Runs are the platform's tally (`readRunStats`, backend
 * §12.1 #73's named alternative to a home-stats endpoint); automations and
 * integrations are the lists those pages read. A recent run is named from the
 * catalog, as Activity names it, and falls back to its template id. `null` when
 * no workspace is active, so nothing is claimed about one.
 *
 * Each figure stands alone: one the platform refuses or cannot answer reads
 * "Unavailable" and the rest still show, rather than one read taking the whole
 * home with it. A session that ended is not a figure's to absorb, so it goes to
 * the account area's boundary as every other page's does.
 */
async function readOverview(workspaceId: string | undefined) {
  if (!workspaceId) return null;
  const [subscriptions, stats, connections, runs, catalog] = await Promise.all([
    figure(() => listSubscriptions(workspaceId)),
    figure(() => readRunStats(workspaceId, startOfMonthUtc(new Date()))),
    figure(() => listConnections(workspaceId)),
    figure(() => listRuns(workspaceId)),
    figure(() => listAutomations(workspaceId)),
  ]);
  const nameFor = new Map(
    (catalog?.automations ?? []).map((entry) => [entry.templateId, entry.name]),
  );
  return {
    automations:
      subscriptions?.subscriptions.filter(
        (entry) => entry.status !== "archived",
      ).length ?? null,
    runs: stats?.workspace ?? null,
    integrations:
      connections?.connections.filter((entry) => entry.status === "connected")
        .length ?? null,
    recent:
      runs?.runs.slice(0, 3).map((run) => ({
        run,
        name: nameFor.get(run.templateId) ?? run.templateId,
      })) ?? null,
  };
}

async function figure<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) return null;
    if (error instanceof PlatformServerError && error.status !== 401) {
      return null;
    }
    throw error;
  }
}

function getFirstName(name?: string | null): string | null {
  if (!name?.trim()) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

export default async function AccountDashboardPage() {
  const session = await getAppSession();
  const firstName = getFirstName(session?.user?.name);
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome back!";

  const activeWorkspaceId = session
    ? await resolveActiveWorkspaceId(session)
    : undefined;
  const [topProjects, overview, canCreateTeam] = session
    ? await Promise.all([
        // A deleted team is archived, and leaves every team list — this one too.
        listAccessibleProjects().then((projects) =>
          projects
            .filter(({ project }) => project.status !== "archived")
            .slice(0, 3),
        ),
        readOverview(activeWorkspaceId),
        // Only an owner or admin creates a team (backend 24.12.1), so Create
        // is offered to them alone, as on the Teams page.
        roleInWorkspace(activeWorkspaceId).then(administers),
      ])
    : [[], null, false];

  // Show workspace name tags when the user's top projects span multiple workspaces
  const uniqueWorkspaceIds = new Set(
    topProjects.map(({ project }) => project.workspaceId),
  );
  const isMultiWorkspace = uniqueWorkspaceIds.size > 1;

  return (
    <SectionCard
      title="Dashboard"
      greeting={greeting}
      subheader="Here's what's happening in your workspace."
      primaryAction={
        <Link
          prefetch={false}
          href="/account/flows"
          className="btn-primary inline-flex px-5"
        >
          Browse flows
        </Link>
      }
      secondaryAction={
        <Link
          prefetch={false}
          href="/account/connections"
          className="btn-secondary inline-flex px-5"
        >
          Connect integration
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            prefetch={false}
            href="/account/flows"
            className="btn-primary inline-flex px-4 py-2 text-sm"
          >
            Browse flows
          </Link>
          <Link
            prefetch={false}
            href="/account/teams"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            View teams
          </Link>
          <Link
            prefetch={false}
            href="/account/connections"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Connect integration
          </Link>
        </div>
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Workspace overview
        </h2>
        {overview ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:max-w-md">
              <dt className="text-[var(--muted)]">Flows</dt>
              <dd className="text-[var(--text)]">
                {overview.automations ?? "Unavailable"}
              </dd>
              <dt className="text-[var(--muted)]">Runs this month</dt>
              <dd className="text-[var(--text)]">
                {overview.runs
                  ? `${overview.runs.total} · ${overview.runs.succeeded} succeeded · ${overview.runs.failed} failed`
                  : "Unavailable"}
              </dd>
              <dt className="text-[var(--muted)]">Integrations</dt>
              <dd className="text-[var(--text)]">
                {overview.integrations ?? "Unavailable"}
              </dd>
            </dl>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Runs are counted from the first of the month, UTC.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No workspace is active yet.
          </p>
        )}
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Recent activity
        </h2>
        {overview && overview.recent === null ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Recent activity could not be read just now.
          </p>
        ) : overview?.recent && overview.recent.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {overview.recent.map(({ run, name }) => (
              <li key={run.id}>
                <Link
                  prefetch={false}
                  href={`/account/runs/${encodeURIComponent(run.id)}`}
                  aria-label={`Run of ${name}, ${run.status}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
                >
                  <span className="font-medium text-[var(--text)]">{name}</span>
                  <StatusPill status={run.status} />
                  <span className="text-xs text-[var(--muted)]">
                    {formatWhen(run.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">No activity yet.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Add a flow to see its runs here.
            </p>
          </>
        )}
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Teams
        </h2>
        {topProjects.length === 0 ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">No teams yet.</p>
            {canCreateTeam ? (
              <div className="mt-3">
                <Link
                  prefetch={false}
                  href="/account/teams"
                  className="btn-secondary inline-flex px-4 py-2 text-sm"
                >
                  Create a team
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {topProjects.map(({ project, workspace }) => (
                <li key={project.id}>
                  <Link
                    prefetch={false}
                    href={`/account/teams/${project.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
                  >
                    {/* A team is its kind (the owner, build 9). */}
                    <span className="font-medium text-[var(--text)]">
                      {project.type}
                    </span>
                    <span className="inline-flex rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)]">
                      {project.status === "active"
                        ? "Active"
                        : project.status === "paused"
                          ? "Paused"
                          : project.status === "draft"
                            ? "Draft"
                            : "Archived"}
                    </span>
                    {isMultiWorkspace ? (
                      <span className="text-xs text-[var(--muted)]">
                        · {workspace.name}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Link
                prefetch={false}
                href="/account/teams"
                className="text-sm font-medium text-[var(--link)] transition hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
              >
                View all teams
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="py-5">
        <div className="rounded-xl border border-[var(--color-divider)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-4 py-4 sm:px-5 sm:py-5">
          <h3 className="text-sm font-medium text-[var(--text)]">
            Get started
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Browse the flows available and connect the accounts one needs.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              prefetch={false}
              href="/account/flows"
              className="btn-primary inline-flex px-5"
            >
              Browse flows
            </Link>
            <Link
              prefetch={false}
              href="/account/connections"
              className="btn-secondary inline-flex px-5"
            >
              Connect integration
            </Link>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
