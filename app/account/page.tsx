import Link from "next/link";
import SectionCard from "@/components/dashboard/SectionCard";

export default function AccountDashboardPage() {
  const hasWorkflows = false;

  return (
    <SectionCard
      title="Dashboard"
      primaryAction={
        <Link href="/automation-builder" className="btn-primary inline-flex px-5">
          Create workflow
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-sm font-medium text-[var(--muted)]">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/automation-builder"
            className="inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Create workflow
          </Link>
          <Link
            href="/automation-builder"
            className="inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Templates
          </Link>
          <Link
            href="/account/settings"
            className="inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Connect an integration
          </Link>
        </div>
      </div>

      <div className="py-5">
        <h2 className="text-sm font-medium text-[var(--muted)]">Usage snapshot</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:max-w-md">
          <dt className="text-[var(--muted)]">Workflows</dt>
          <dd className="text-[var(--text)]">—</dd>
          <dt className="text-[var(--muted)]">Runs this month</dt>
          <dd className="text-[var(--text)]">—</dd>
          <dt className="text-[var(--muted)]">Integrations</dt>
          <dd className="text-[var(--text)]">—</dd>
        </dl>
      </div>

      <div className="py-5">
        <h2 className="text-sm font-medium text-[var(--muted)]">Recent activity</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">No recent activity</p>
      </div>

      <div className="py-5">
        <h2 className="text-sm font-medium text-[var(--muted)]">Projects</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">No projects yet</p>
      </div>

      {!hasWorkflows && (
        <div className="py-5">
          <h3 className="text-base font-semibold text-[var(--text)]">No workflows yet</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create your first workflow with the builder or pick a template to get started.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/automation-builder" className="btn-primary inline-flex px-5">
              Create workflow
            </Link>
            <Link href="/automation-builder" className="btn-secondary inline-flex px-5">
              Browse templates
            </Link>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
