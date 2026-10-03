import Link from "next/link";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listRuns,
  formatWhen,
  type Run,
} from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

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
  const workspaceId = await resolveActiveWorkspaceId(session);

  if (!workspaceId) {
    return (
      <SectionCard title="Activity" subheader="Every run in this workspace">
        <EmptyRow text="No workspace is active yet." />
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
        // The whole page is empty: the app's empty screen, with the way to a
        // first flow (the owner, build 9).
        <EmptyRow
          icon={<CheckCircleIcon size={32} />}
          title="No activity yet"
          text="Every run lands here the moment your first agent goes live."
          action={
            <Link
              prefetch={false}
              href="/account/flows"
              className="btn-primary inline-flex px-5"
            >
              Browse flows
            </Link>
          }
        />
      ) : (
        runs.runs.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            name={nameFor.get(run.templateId) ?? run.templateId}
          />
        ))
      )}
    </SectionCard>
  );
}

function RunRow({ run, name }: { run: Run; name: string }) {
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
