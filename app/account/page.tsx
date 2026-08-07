import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import { getAccessibleProjects } from "@/lib/projects";
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

  const userId = session?.user?.id;

  const topProjects =
    userId != null ? await getAccessibleProjects(userId, 3) : [];

  // Show workspace name tags when the user's top projects span multiple workspaces
  const uniqueWorkspaceIds = new Set(
    topProjects.map((p) => p.workspaceId).filter(Boolean),
  );
  const isMultiWorkspace = uniqueWorkspaceIds.size > 1;

  return (
    <SectionCard
      title="Dashboard"
      greeting={greeting}
      subheader="Here's what's happening in your workspace."
      primaryAction={
        <Link href="/account/builder" className="btn-primary inline-flex px-5">
          Create workflow
        </Link>
      }
      secondaryAction={
        <Link
          href="/account/builder"
          className="btn-secondary inline-flex px-5"
        >
          Browse templates
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/account/builder"
            className="btn-primary inline-flex px-4 py-2 text-sm"
          >
            Create workflow
          </Link>
          <Link
            href="/account/builder"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
          >
            Browse templates
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
          <dt className="text-[var(--muted)]">Workflows</dt>
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
          Create your first workflow to see runs and events here.
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
              {topProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/account/projects/${p.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="font-medium text-[var(--text)]">
                      {p.name}
                    </span>
                    <span className="inline-flex rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)]">
                      {p.status === "active"
                        ? "Active"
                        : p.status === "paused"
                          ? "Paused"
                          : p.status === "draft"
                            ? "Draft"
                            : "Archived"}
                    </span>
                    {isMultiWorkspace && p.workspaceName ? (
                      <span className="text-xs text-[var(--muted)]">
                        · {p.workspaceName}
                      </span>
                    ) : p.ownerName ? (
                      <span className="text-xs text-[var(--muted)]">
                        · {p.ownerName}
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
            Create your first workflow or choose a template.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/account/builder"
              className="btn-primary inline-flex px-5"
            >
              Create workflow
            </Link>
            <Link
              href="/account/builder"
              className="btn-secondary inline-flex px-5"
            >
              Browse templates
            </Link>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
