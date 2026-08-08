import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listRuns,
  formatWhen,
  type Run,
} from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { StatusPill } from "@/components/dashboard/StatusPill";

/**
 * Activity — every run this workspace has had.
 *
 * A run carries `templateId` and no display name, deliberately: a finished run
 * must not be relabelled by a later manifest. So the name is joined from the
 * catalog here, and a run whose template is no longer offered falls back to the
 * id rather than rendering blank.
 */

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const session = await getAppSession();
  const workspaceId = session?.user.workspaceId ?? session?.workspaces[0]?.id;

  if (!workspaceId) {
    return (
      <SectionCard title="Activity" subheader="Every run in this workspace">
        <Empty text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const [runs, catalog] = await Promise.all([
    emptyWhenUnavailable(() => listRuns(workspaceId), { runs: [] }),
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
  ]);

  const nameFor = new Map(
    catalog.automations.map((entry) => [entry.templateId, entry.name]),
  );

  return (
    <SectionCard title="Activity" subheader="Every run in this workspace">
      {runs.runs.length === 0 ? (
        <Empty text="No runs yet. Add an automation and run it to see activity here." />
      ) : (
        runs.runs.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            name={nameFor.get(run.templateId) ?? run.templateId}
            workspaceId={workspaceId}
          />
        ))
      )}
    </SectionCard>
  );
}

function RunRow({
  run,
  name,
  workspaceId,
}: {
  run: Run;
  name: string;
  workspaceId: string;
}) {
  return (
    <Link
      href={`/account/runs/${run.id}`}
      prefetch={false}
      className="flex flex-col gap-2 py-4 transition first:pt-0 hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`Run of ${name}, ${run.status}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--text)]">
            {name}
          </p>
          {/* A continuation is part of the run above it, not a separate piece of
              work. Saying so is why rootRunId exists. */}
          {run.origin === "approval-continuation" ? (
            <span className="text-xs text-[var(--muted)]">after approval</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {formatWhen(run.createdAt)} · v{run.templateVersion}
        </p>
      </div>
      <StatusPill status={run.status} />
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-5 first:pt-0">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}
