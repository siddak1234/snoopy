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
import { Group } from "@/components/dashboard/Group";
import { PageRow } from "@/components/dashboard/PageRow";
import { LIST_CARD } from "@/components/dashboard/SectionRows";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { fill } from "@/lib/block-sort";
import { activityPages, activityQuery } from "@/lib/flow-steps";
import {
  BLOCK_SEARCH,
  BLOCK_WORDS,
} from "@/lib/generated/platform-contracts/block-rules";
import { runLabel } from "@/lib/run-progress";
import { SPACING } from "@/lib/spacing";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import { ActivityControls, ActivityPager } from "./ActivityControls";

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
 *
 * Its search box is always there ("Search runs"), and on more than 25 runs
 * the sort and the pages (backend ADR-0048 amendment 1, decision 4): `q`,
 * `sort` and `page` are kept in the address (`ActivityControls`) and sent
 * on, with the outcome as `status` and the time as `since`, to the platform,
 * which searches, filters and counts them (`runsQuery`) — so a page is never
 * emptied by a filter here. The website has no "Needs review".
 */

export const dynamic = "force-dynamic";

/** The outcomes a flow's Dashboard opens this list on, in its tiles' words. */
const OUTCOMES = { succeeded: "Successes", failed: "Failures" } as const;

export default async function RunsPage(props: PageProps<"/account/runs">) {
  const query = activityQuery(await props.searchParams);
  const { flowId, outcome, since } = query;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);

  if (!workspaceId) {
    return (
      <SectionCard title="Activity" subheader="Every run in this workspace">
        <EmptyRow text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const [listed, catalog, subscriptions] = await Promise.all([
    emptyWhenUnavailable(() => listRuns(workspaceId, query), { runs: [] }),
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
  // The platform searched, filtered and counted them (`total`). An answer
  // without `total` — today's newest 100, from a platform before the search
  // — is one page, its outcome and time kept here as before.
  const counted = typeof listed.total === "number";
  const runs = counted
    ? listed.runs
    : listed.runs.filter(
        (run) =>
          (!outcome || run.status === outcome) &&
          (!since || Date.parse(run.createdAt) >= Date.parse(since)),
      );
  const { long, pages } = activityPages(listed.total, BLOCK_SEARCH.pageSize);
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
      <Group>
        <div className={`flex flex-col ${SPACING.inner.gap}`}>
          <ActivityControls query={query} long={long} />
          {runs.length === 0 ? (
            query.q ? (
              <EmptyRow
                band={false}
                text={fill(BLOCK_WORDS.noMatch, { query: query.q })}
              />
            ) : (
              // The whole page is empty: the app's empty screen, with the way
              // to a first flow (the owner, build 9).
              <EmptyRow
                icon={<CheckCircleIcon size={32} />}
                title="No activity yet"
                text="Every run lands here the moment your first agent goes live."
                action={
                  <Button href="/account/flows" prefetch={false}>
                    Browse flows
                  </Button>
                }
              />
            )
          ) : (
            <ul data-testid="activity-runs" className={LIST_CARD}>
              {runs.map((run) => (
                <li key={run.id}>
                  <RunRow
                    run={run}
                    name={nameFor.get(run.templateId) ?? run.templateId}
                  />
                </li>
              ))}
            </ul>
          )}
          {long ? <ActivityPager query={query} pages={pages} /> : null}
        </div>
      </Group>
    </SectionCard>
  );
}

/** A run's row (`PageRow`): its flow, then when and its full id; its status at its end. */
function RunRow({ run, name }: { run: Run; name: string }) {
  return (
    <PageRow
      href={`/account/runs/${run.id}`}
      boxed={false}
      label={`Run of ${name}, ${run.status}`}
      end={<StatusPill status={run.status} />}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-[var(--text)]">{name}</span>
        <span className="text-xs break-all text-[var(--muted)]">
          {formatWhen(run.createdAt)} · {runLabel(run.id)}
        </span>
      </span>
    </PageRow>
  );
}
