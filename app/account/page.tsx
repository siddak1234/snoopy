import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import { listAccessibleProjects } from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";

function getFirstName(name?: string | null): string | null {
  if (!name?.trim()) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

export default async function AccountDashboardPage() {
  const session = await getAppSession();
  const firstName = getFirstName(session?.user?.name);
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome back!";

  const topProjects = session
    ? (await listAccessibleProjects()).slice(0, 3)
    : [];

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
        <Link href="/solutions" className="btn-primary inline-flex px-5">
          Browse automations
        </Link>
      }
      secondaryAction={
        <Link
          href="/account/settings"
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
            href="/solutions"
            className="btn-primary inline-flex px-4 py-2 text-sm"
          >
            Browse automations
          </Link>
          <Link
            href="/account/projects"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
          >
            View projects
          </Link>
          <Link
            href="/account/settings"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
          >
            Connect integration
          </Link>
        </div>
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Workspace overview
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:max-w-md">
          <dt className="text-[var(--muted)]">Automations</dt>
          <dd className="text-[var(--text)]">0</dd>
          <dt className="text-[var(--muted)]">Runs this month</dt>
          <dd className="text-[var(--text)]">0</dd>
          <dt className="text-[var(--muted)]">Integrations</dt>
          <dd className="text-[var(--text)]">0</dd>
        </dl>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Connect an integration to start automations.
        </p>
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Recent activity
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">No activity yet.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Subscribe to an automation to see runs and events here.
        </p>
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Projects
        </h2>
        {topProjects.length === 0 ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">No projects yet.</p>
            <div className="mt-3">
              <Link
                href="/account/projects"
                className="btn-secondary inline-flex px-4 py-2 text-sm"
              >
                Create project
              </Link>
            </div>
          </>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {topProjects.map(({ project, workspace }) => (
                <li key={project.id}>
                  <Link
                    href={`/account/projects/${project.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="font-medium text-[var(--text)]">
                      {project.name}
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
                href="/account/projects"
                className="text-sm font-medium text-[var(--link)] transition hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
              >
                View all projects
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
            Browse the automations available and connect the accounts one needs.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/solutions" className="btn-primary inline-flex px-5">
              Browse automations
            </Link>
            <Link
              href="/account/settings"
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
