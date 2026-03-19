import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getWorkflowsForUser } from "@/lib/workflows";
import SectionCard from "@/components/dashboard/SectionCard";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";

function formatRelative(iso: Date): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const statusColors: Record<string, string> = {
  draft:
    "border-[var(--ring)] bg-[var(--step-pill-bg)] text-[var(--step-pill-text)]",
  active: "border-emerald-400/40 bg-emerald-500/10 text-emerald-400",
  archived: "border-[var(--ring)] bg-[var(--surface)] text-[var(--muted)]",
};

export default async function AccountWorkflowDesignPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    const cookieStore = await cookies();
    const hasSupabaseAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token"));
    if (hasSupabaseAuthCookies) {
      return <AuthHydrationGate destination="/account/workflow-design" />;
    }
    redirect("/login?callbackUrl=/account/workflow-design");
  }

  const workflows = await getWorkflowsForUser(session.user.id);

  return (
    <SectionCard
      title="Workflow Design"
      subheader="Design, save, and manage your automation workflows"
      primaryAction={
        <Link
          href="/automation-builder"
          className="btn-primary inline-flex items-center gap-2 px-5"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M8 3.333v9.334M3.333 8h9.334" />
          </svg>
          New Workflow
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Saved workflows
        </h2>

        {workflows.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-[var(--accent)]/50"
              aria-hidden
            >
              <rect x="8" y="8" width="32" height="32" rx="8" />
              <path d="M24 18v12M18 24h12" />
            </svg>
            <p className="text-sm font-medium text-[var(--muted)]">
              No saved workflows yet
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--muted)]/70">
              Create your first automation workflow in the builder. Your saved
              workflows will appear here.
            </p>
            <Link
              href="/automation-builder"
              className="btn-primary mt-2 inline-flex items-center gap-2 px-5"
            >
              Open Automation Builder
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {workflows.map((wf) => (
              <Link
                key={wf.id}
                href={`/automation-builder?id=${wf.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                    {wf.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${statusColors[wf.status] ?? statusColors.draft}`}
                  >
                    {wf.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[0.65rem] text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      className="h-3 w-3"
                    >
                      <rect x="3" y="3" width="10" height="10" rx="2" />
                    </svg>
                    {wf.nodeCount} {wf.nodeCount === 1 ? "node" : "nodes"}
                  </span>
                  <span>Updated {formatRelative(wf.updatedAt)}</span>
                </div>

                <div className="flex items-center gap-1 text-[0.6rem] font-medium text-[var(--accent)] opacity-0 transition group-hover:opacity-100">
                  Open in builder
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <path d="M3.333 8h9.334M8.667 4l4 4-4 4" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
