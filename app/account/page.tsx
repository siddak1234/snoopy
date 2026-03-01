import Link from "next/link";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import SectionCard from "@/components/dashboard/SectionCard";

function getFirstName(name?: string | null): string | null {
  if (!name?.trim()) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

export default async function AccountDashboardPage() {
  const session = await getServerSession(getAuthOptions());
  const firstName = getFirstName(session?.user?.name);
  const greeting = firstName
    ? `Welcome, ${firstName}!`
    : "Welcome back!";

  return (
    <SectionCard
      title="Dashboard"
      greeting={greeting}
      subheader="Here's what's happening in your workspace."
      primaryAction={
        <Link href="/automation-builder" className="btn-primary inline-flex px-5">
          Create workflow
        </Link>
      }
      secondaryAction={
        <Link
          href="/automation-builder"
          className="btn-secondary inline-flex px-5"
        >
          Browse templates
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/automation-builder"
            className="btn-primary inline-flex px-4 py-2 text-sm"
          >
            Create workflow
          </Link>
          <Link
            href="/automation-builder"
            className="inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Browse templates
          </Link>
          <Link
            href="/account/settings"
            className="inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Connect integration
          </Link>
        </div>
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
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
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Recent activity
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">No activity yet.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Create your first workflow to see runs and events here.
        </p>
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Projects
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">No projects yet.</p>
        <div className="mt-3">
          <Link
            href="/automation-builder"
            className="inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Start with a template
          </Link>
        </div>
      </div>

      <div className="py-5">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 sm:px-5 sm:py-5">
          <h3 className="text-sm font-semibold text-[var(--text)]">Get started</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create your first workflow or choose a template.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/automation-builder" className="btn-primary inline-flex px-5">
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
      </div>
    </SectionCard>
  );
}
