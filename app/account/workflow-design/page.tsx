import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getWorkflowsForUser } from "@/lib/workflows";
import SectionCard from "@/components/dashboard/SectionCard";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";
import { WorkflowCardsClient } from "@/components/workflows/WorkflowCardsClient";

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
          <WorkflowCardsClient workflows={workflows.map((w) => ({
            ...w,
            createdAt: w.createdAt.toISOString(),
            updatedAt: w.updatedAt.toISOString(),
          }))} />
        )}
      </div>
    </SectionCard>
  );
}
