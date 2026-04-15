import Link from "next/link";
import { getAppSession } from "@/lib/auth-supabase";
import { getAccessibleProjects } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { DomainVerificationBanner } from "@/components/dashboard/DomainVerificationBanner";
import { prisma } from "@/lib/db";

function getFirstName(name?: string | null): string | null {
  if (!name?.trim()) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

export default async function AccountDashboardPage() {
  const session = await getAppSession();
  const firstName = getFirstName(session?.user?.name);
  const greeting = firstName
    ? `Welcome, ${firstName}!`
    : "Welcome back!";

  const userId = session?.user?.id;
  const workspaceId = session?.user?.workspaceId;

  // Fetch top projects and membership info in parallel
  const [topProjects, membershipInfo] = await Promise.all([
    userId != null ? getAccessibleProjects(userId, 3) : Promise.resolve([]),
    userId && workspaceId
      ? prisma.membership.findUnique({
          where: { userId_workspaceId: { userId, workspaceId } },
          select: {
            role: true,
            workspace: {
              select: { type: true, domain: true, domainVerified: true },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const isOrgOwner =
    membershipInfo?.role === "OWNER" &&
    membershipInfo.workspace.type === "organization";

  // Show workspace name tags when the user's top projects span multiple workspaces
  const uniqueWorkspaceIds = new Set(
    topProjects.map((p) => p.workspaceId).filter(Boolean)
  );
  const isMultiWorkspace = uniqueWorkspaceIds.size > 1;

  // Show domain verification banner if owner of an unverified org workspace
  const unverifiedDomain =
    isOrgOwner &&
    membershipInfo &&
    !membershipInfo.workspace.domainVerified &&
    membershipInfo.workspace.domain
      ? membershipInfo.workspace.domain
      : null;


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
      {unverifiedDomain ? (
        <div className="pt-5 first:pt-0">
          <DomainVerificationBanner domain={unverifiedDomain} />
        </div>
      ) : null}

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
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Browse templates
          </Link>
          <Link
            href="/account/settings"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
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
                    className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
                  >
                    <span className="font-medium text-[var(--text)]">{p.name}</span>
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
                      <span className="text-xs text-[var(--muted)]">· {p.workspaceName}</span>
                    ) : p.ownerName ? (
                      <span className="text-xs text-[var(--muted)]">· {p.ownerName}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Link
                href="/account/projects"
                className="text-sm font-medium text-[var(--link)] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
              >
                View all projects
              </Link>
            </div>
          </>
        )}
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
