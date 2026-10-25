import { FlowArrowIcon } from "@phosphor-icons/react/dist/ssr/FlowArrow";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  formatDay,
  listArchivedSubscriptions,
  listAutomations,
  listSubscriptions,
  type AutomationCatalogEntry,
  type Subscription,
} from "@/lib/automations";
import { heldCopy } from "@/lib/held-flow";
import { flowsOverPlan, overPlanSentence } from "@/lib/plan-limit";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { flowPath } from "@/lib/flow-steps";
import { AddAutomation } from "./AddAutomation";
import { byDepartment } from "./departments";
import { placeOf } from "./place";
import { listWorkspaceProjects, resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * The catalog, and what this workspace has done with it.
 *
 * Two reads rather than one because the server keeps them apart: the catalog is
 * global and says whether a workspace `subscribed`, while the subscription row
 * holds the status, the pinned version, and any unmet connections. Joining them
 * here is what lets one card show both "Added" and "Live".
 *
 * **A flow goes to the team of its category** (backend ADR-0036; the owner,
 * 2026-10-14: "theres no choose a team. there will be pre existing teams
 * depending on which flows are added"): Add sends no team, and the platform
 * puts the flow in the team of its kind — the card's category — making it when
 * the workspace has none. Every flow says its team, "Team: Accounting"; one
 * added to the whole workspace before teams says that instead.
 *
 * **A workspace holds each flow once** (the owner, build 12's #9; register
 * F87): Personal is one workspace and each organization another. A flow is
 * held while a subscription of it is not archived (`heldCopy`), and its card
 * then says "Added ✓", which goes to it. A card still lists every subscription
 * it has (register F21), so a duplicate from before is listed, never hidden.
 * Each is visible only to the people who can see its team — the platform
 * filters the list (a team is a project in its contract).
 *
 * **A flow is opened, not worked on its card** (Build 21, spec A6; the
 * owner's AM4: "after that flow page is the run page"): each flow the
 * workspace holds shows its team, its status and Open — its page, where it is
 * run, set up again, paused, moved and archived. Add adds the flow and opens
 * its Set up, once. ~~Run, Set up, Turn on / Pause, Archive flow, the move and
 * the webhook address on the card~~ until Build 21.
 *
 * **By department** (plan §3; the owner's build 28 item 1): the cards are
 * grouped under their department, the catalog's `category`, the departments
 * A–Z (`byDepartment`) — the header says it, so the card no longer does.
 *
 * Archived flows are read by name (`status=archived`, backend §12.1 #203) and
 * listed last, each with the day it was archived (BUILD-PLAN 24.11.11) and
 * Unarchive (the owner, build 12's #4): the card's own Add, which adds the
 * flow afresh — the platform's archive is one-way. A flow held again says
 * where it is instead, as its card does.
 */

export const dynamic = "force-dynamic";

/** The card's subtitle (spec §3.A). */
const SUBTITLE = "Ready-made flows for your departments.";

export default async function FlowsPage() {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);

  if (!workspaceId) {
    return (
      <SectionCard title="Flows" subheader={SUBTITLE}>
        <EmptyRow text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const [catalog, subscriptions, archived, projects] = await Promise.all([
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    emptyWhenUnavailable(() => listArchivedSubscriptions(workspaceId), []),
    emptyWhenUnavailable(() => listWorkspaceProjects(workspaceId), []),
  ]);
  // Over the plan's flow allowance, the whole workspace's (decision 7a3).
  const overPlan = flowsOverPlan(subscriptions.flowAllowance);

  // Archiving is one-way and is how a workspace gives a plan slot back; using
  // that automation again means subscribing afresh, which the archived list
  // calls unarchiving it (the owner, build 12's #4). The list's contract does
  // not promise to omit archived rows, so one is treated as absent here: it
  // holds nothing, and its card offers Add once more.
  const byTemplate = new Map<string, Subscription[]>();
  for (const entry of subscriptions.subscriptions) {
    if (entry.status === "archived") continue;
    byTemplate.set(entry.templateId, [
      ...(byTemplate.get(entry.templateId) ?? []),
      entry,
    ]);
  }
  const catalogEntry = new Map(
    catalog.automations.map((entry) => [entry.templateId, entry]),
  );
  // An archived flow keeps the team it was in, deleted or not. A team is its
  // kind (the owner, build 9).
  const place = placeOf(projects, catalogEntry);

  return (
    <SectionCard title="Flows" subheader={SUBTITLE}>
      {overPlan ? (
        // Every flow is held from starting a run, so this is said above them
        // all, in the app's words (the owner's build 13 decision 7a3).
        <p
          role="status"
          data-testid="flows-over-plan"
          className="mb-4 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)]"
        >
          {overPlanSentence(overPlan.allowed, overPlan.live)}
        </p>
      ) : null}
      {catalog.automations.length === 0 ? (
        // The whole page is empty: the app's empty screen, in its words (the
        // owner, build 10). There is nowhere to go until the catalog has one.
        <EmptyRow
          icon={<FlowArrowIcon size={32} />}
          title="No flows to add yet"
          text="More are on the way."
        />
      ) : (
        byDepartment(catalog.automations).map(({ department, id, entries }) => (
          <section
            key={id}
            aria-labelledby={id}
            data-testid="flows-department"
            className="py-5 first:pt-0"
          >
            <h2
              id={id}
              className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
            >
              {department}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {entries.map((automation) => (
                <AutomationCard
                  key={`${automation.templateId}.v${automation.version}`}
                  automation={automation}
                  subscriptions={byTemplate.get(automation.templateId) ?? []}
                  place={place}
                  workspaceId={workspaceId}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {archived.length > 0 ? (
        <div className="border-t border-[var(--ring)] py-5">
          <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Archived flows
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            An archived flow keeps its history here. Unarchive it any time.
          </p>
          <ul className="mt-3 divide-y divide-[var(--ring)]">
            {archived.map((subscription) => {
              const entry = catalogEntry.get(subscription.templateId);
              const name =
                subscription.name ?? entry?.name ?? subscription.templateId;
              // Held again, in any team or the whole workspace (#9), the row
              // says where, as the card does, and goes to it: there is nothing
              // to unarchive (D3's live twin).
              const twin = heldCopy(
                subscriptions.subscriptions,
                subscription.templateId,
              );
              return (
                <li
                  key={subscription.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {place(subscription)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-[var(--muted)]">
                      Archived {formatDay(subscription.updatedAt)}
                    </span>
                    {/* A flow the catalog no longer lists has no card: nothing
                        to add afresh, and no row to go to. */}
                    {!entry ? null : twin ? (
                      <a
                        href={`#flow-${twin.id}`}
                        className="inline-flex min-h-6 items-center text-xs text-[var(--muted)] underline underline-offset-2"
                      >
                        Added ✓
                      </a>
                    ) : (
                      <AddAutomation
                        workspaceId={workspaceId}
                        templateId={subscription.templateId}
                        name={name}
                        available={entry.available}
                        unarchive
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

function AutomationCard({
  automation,
  subscriptions,
  place,
  workspaceId,
}: {
  automation: AutomationCatalogEntry;
  subscriptions: Subscription[];
  place: (subscription: Subscription) => string;
  /** The workspace this page shows; Add is refused once it is not active. */
  workspaceId: string;
}) {
  // Held anywhere in the workspace, the flow is added once (the owner, build
  // 12's #9): "Added ✓" goes to it, and Add is not drawn.
  const held = heldCopy(subscriptions, automation.templateId);

  return (
    <div className="bubble flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Its department is its group's header (build 28's item 1). */}
          <h3
            id={`automation-${automation.templateId}-name`}
            className="truncate text-base font-medium text-[var(--text)]"
          >
            {automation.name}
          </h3>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">{automation.description}</p>

      {/* The price; the version is not the card's to say (spec §3.A, S9). */}
      <p className="text-xs text-[var(--text)]">
        {automation.monthlyPriceUsd === 0
          ? "Included"
          : `$${automation.monthlyPriceUsd}/mo`}
      </p>

      {/* `available` is evidence from a reachability probe. Saying so beats an
          Add button that fails at the first run. */}
      {!automation.available ? (
        <p className="text-xs text-[var(--warning-text)]">
          This flow is not responding, so it cannot run yet.
        </p>
      ) : null}

      {subscriptions.map((subscription) => (
        // Where "Added ✓" below goes: the flow, its team, status and Open.
        <div
          key={subscription.id}
          id={`flow-${subscription.id}`}
          tabIndex={-1}
          className="flex flex-col gap-2 border-t border-[var(--ring)] pt-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">{place(subscription)}</p>
            <StatusPill status={subscription.status} />
          </div>

          <div>
            <Button
              href={flowPath(subscription.id)}
              variant="secondary"
              size="sm"
              prefetch={false}
              aria-label={`Open ${automation.name}`}
            >
              Open
            </Button>
          </div>
        </div>
      ))}

      <div className="mt-auto">
        {/* Held, it says so and goes to it (the owner, build 12's #9); its
            team is on its row above. */}
        {held ? (
          <a
            href={`#flow-${held.id}`}
            className="inline-flex min-h-6 items-center text-xs text-[var(--muted)] underline underline-offset-2"
          >
            Added ✓
          </a>
        ) : (
          <AddAutomation
            workspaceId={workspaceId}
            templateId={automation.templateId}
            name={automation.name}
            available={automation.available}
          />
        )}
      </div>
    </div>
  );
}
