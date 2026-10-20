import Link from "next/link";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listRuns,
  listSubscriptions,
  formatWhen,
  type Run,
} from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { activityFilter } from "@/lib/flow-steps";
import { runLabel } from "@/lib/run-progress";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * Activity — every job this workspace has had, one entry each, by the job's
 * id: a job is its first run, and an approval continues it under that id
 * (Build 24, P9; backend ADR-0044) — ~~an "after approval" row of its own~~
 * until Build 24.
 *
 * A run carries `templateId` and no display name, deliberately: a finished run
 * must not be relabelled by a later manifest. So the name is joined from the
 * catalog here, and a run whose template is no longer offered falls back to the
 * id rather than rendering blank. Each run is named by its FULL id under its
 * flow's name — "{when} · Run {id}" (Build 21, spec A8; the owner's D4 and
 * AM2: "runs should have the full ID"; ~~"· v{version}"~~ until Build 21).
 *
 * A flow page's Dashboard opens this list for one flow (`?flow=`), and for its
 * successes or failures (`&status=`), as the app's Activity is filtered (spec
 * A6); the dashboard's Today tiles open it from the browser's midnight
 * (`&since=`, Build 22's W1; the session's S27), keeping the runs made since —
 * "Today", or "Today · Successes" / "Today · Failures". The subheader says
 * which.
 */

export const dynamic = "force-dynamic";

/** The outcomes a flow's Dashboard opens this list on, in its tiles' words. */
const OUTCOMES = { succeeded: "Successes", failed: "Failures" } as const;

export default async function RunsPage(props: PageProps<"/account/runs">) {
  const { flow, status, since: from } = await props.searchParams;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  const { flowId, outcome, since } = activityFilter(flow, status, from);

  if (!workspaceId) {
    return (
      <SectionCard title="Activity" subheader="Every run in this workspace">
        <EmptyRow text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const [listed, catalog, subscriptions] = await Promise.all([
    emptyWhenUnavailable(() => listRuns(workspaceId, flowId), { runs: [] }),
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    flowId
      ? emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
          subscriptions: [],
        })
      : { subscriptions: [] },
  ]);

  const nameFor = new Map(
    catalog.automations.map((entry) => [entry.templateId, entry.name]),
  );
  const runs = {
    runs: listed.runs.filter(
      (run) =>
        (!outcome || run.status === outcome) &&
        (!since || Date.parse(run.createdAt) >= Date.parse(since)),
    ),
  };
  // One flow's runs: its name, and the outcome its tile opened.
  const shown = subscriptions.subscriptions.find(
    (subscription) => subscription.id === flowId,
  );
  const flowName = flowId
    ? (shown?.name ??
      nameFor.get(shown?.templateId ?? listed.runs[0]?.templateId ?? "") ??
      "One flow")
    : null;
  const scope = flowName ?? (since ? "Today" : null);
  const subheader = scope
    ? [scope, outcome ? OUTCOMES[outcome] : null].filter(Boolean).join(" · ")
    : "Every run in this workspace";

  return (
    <SectionCard title="Activity" subheader={subheader}>
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
        <p className="truncate text-sm font-medium text-[var(--text)]">
          {name}
        </p>
        <p className="mt-0.5 text-xs break-all text-[var(--muted)]">
          {formatWhen(run.createdAt)} · {runLabel(run.id)}
        </p>
      </div>
      <StatusPill status={run.status} />
    </Link>
  );
}
