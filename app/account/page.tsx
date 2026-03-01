import Link from "next/link";

export default function AccountDashboardPage() {
  const hasWorkflows = false;

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/automation-builder"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Create workflow
          </Link>
          <Link
            href="/automation-builder"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Templates
          </Link>
          <Link
            href="/account/settings"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Connect an integration
          </Link>
        </div>
      </section>

      {/* Grid: Usage Snapshot, Recent Activity, Projects */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Usage Snapshot */}
        <section className="bubble p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Usage snapshot
          </h2>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Placeholder stats — no data source connected yet.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>Workflows: —</li>
            <li>Runs this month: —</li>
            <li>Integrations: —</li>
          </ul>
        </section>

        {/* Recent Activity */}
        <section className="bubble p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Recent activity
          </h2>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Placeholder list — no event schema yet.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>No recent activity</li>
          </ul>
        </section>

        {/* Projects */}
        <section className="bubble p-5 sm:p-6 sm:col-span-2 lg:col-span-1">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Projects
          </h2>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Placeholder list — no backend fields yet.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>No projects yet</li>
          </ul>
        </section>
      </div>

      {/* Empty state when no workflows */}
      {!hasWorkflows && (
        <section className="flex justify-center">
          <div className="bubble w-full max-w-md p-6 text-center">
            <h3 className="text-base font-semibold text-[var(--text)]">
              No workflows yet
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Create your first workflow with the builder or pick a template to
              get started.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/automation-builder"
                className="btn-primary inline-flex px-5"
              >
                Create workflow
              </Link>
              <Link
                href="/automation-builder"
                className="btn-secondary inline-flex px-5"
              >
                Browse templates
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
