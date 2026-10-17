import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  readRunStats,
  type AutomationSetupField,
} from "@/lib/automations";
import {
  emptyConnectionsWhenUnavailable,
  listConnectionProviders,
  listConnections,
} from "@/lib/connections";
import { connectionFor, connectionState } from "@/lib/connection-rows";
import {
  NONE,
  chosenVendor,
  connectionFields,
  flowPath,
  flowStepPlan,
  setupPath,
} from "@/lib/flow-steps";
import { newIdempotencyKey } from "@/lib/platform-server";
import {
  administers,
  listWorkspaceProjects,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import {
  CONNECTION_ROW,
  ConnectionMark,
  ConnectionRowBody,
  NoneMark,
} from "@/components/dashboard/ConnectionRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ConnectionsPanel } from "@/app/account/connections/ConnectionsPanel";
import { AutomationActions } from "../AutomationActions";
import { FlowDashboard } from "../FlowDashboard";
import { RunStart } from "../RunStart";
import { placeOf } from "../place";
import { owedLines, vendorPath } from "../vendor-path";

/**
 * A flow's page — the run page for a flow (Build 21, spec A6; the owner's AM4
 * of 2026-10-15: "set up page is initial, after that flow page is the run
 * page … when a user clicks a flow it shows basically steps to run now in the
 * way i described in feedback"). The TEST VERSION of his order (D3: "lets test
 * this flow page order first then we can agree if it should be the standard"),
 * top to bottom — the app's flow page on the website (the session's S23):
 *
 * 1. its name, its status and its team — no description (the session's S24);
 * 2. **Dashboard** — Runs, Successes, Failures, live (`FlowDashboard`);
 * 3. **Steps** — numbered, one per group (or step); Step 1 holds the document
 *    and Start run (Turn on while it is off) and what the flow is owed; the
 *    step that writes to a vendor shows the vendor chosen: its mark, its name,
 *    "Connected" or "Not connected" — the whole row opens Connect vendor
 *    (~~"Connect vendor", drawn whatever the connection's state~~, the owner's
 *    build 20 items 4–5). Settings are edited on Set up, through Edit setup,
 *    as in the app (its M3);
 * 4. **Connections** — every account the flow uses, the one connection row;
 * 5. at the bottom: Pause, the move to a newer version, **Edit setup**, the
 *    webhook address, Archive.
 *
 * Opened from its card on Flows (Open) and from the dashboard's Run a flow
 * (A9), which lands on Step 1 (`#run`).
 */

export const dynamic = "force-dynamic";

export default async function FlowPage(
  props: PageProps<"/account/flows/[subscriptionId]">,
) {
  const { subscriptionId } = await props.params;
  const { status: callback } = await props.searchParams;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const [
    subscriptions,
    catalog,
    stats,
    providers,
    connections,
    projects,
    role,
  ] = await Promise.all([
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    emptyWhenUnavailable(() => readRunStats(workspaceId), null),
    emptyConnectionsWhenUnavailable(listConnectionProviders, {
      providers: [],
    }),
    emptyConnectionsWhenUnavailable(() => listConnections(workspaceId), {
      connections: [],
    }),
    emptyWhenUnavailable(() => listWorkspaceProjects(workspaceId), []),
    roleInWorkspace(workspaceId),
  ]);

  // A flow this person can see and has not archived; any other id is the same
  // "not found" a flow that does not exist is.
  const subscription = subscriptions.subscriptions.find(
    (candidate) =>
      candidate.id === subscriptionId && candidate.status !== "archived",
  );
  if (!subscription) notFound();
  const entry = catalog.automations.find(
    (candidate) => candidate.templateId === subscription.templateId,
  );
  const name = subscription.name ?? entry?.name ?? subscription.templateId;
  const team = placeOf(
    projects,
    new Map(catalog.automations.map((item) => [item.templateId, item])),
  )(subscription);
  const canManage = administers(role);
  const live = subscription.status === "live";
  const available = entry?.available === true;
  const providerById = new Map(
    providers.providers.map((provider) => [provider.providerId, provider]),
  );
  const connected = (providerId: string) =>
    connectionState(connectionFor(connections.connections, providerId)) ===
    "connected";

  // Each step's vendor choice (backend ADR-0040), from the version the flow
  // RUNS — none when it declares none — never the catalog's newer one
  // (backend §12.1 #185), as its Set up and its Connect vendor page read it:
  // a row drawn from the catalog's would open a vendor page that is not found.
  const setup: AutomationSetupField[] = subscription.setup ?? [];
  const vendorFields = connectionFields(setup);
  const declared = entry?.requiredConnections ?? [];
  const nameOf = (providerId: string) =>
    declared.find((connection) => connection.providerId === providerId)
      ?.displayName ??
    providerById.get(providerId)?.displayName ??
    providerId;
  const owed = owedLines(
    { ...subscription, setup },
    declared,
    providers.providers,
    connected,
  );
  // STEPS by the catalog's groups only for the version they were declared
  // for; a flow on another version gets its steps by title.
  const plan = flowStepPlan(
    entry?.pipeline,
    entry?.version === subscription.templateVersion ? entry.groups : undefined,
    vendorFields,
  );

  /** The vendor a step writes to: its mark, its name, its state — the whole row opens Connect vendor (A3). */
  const vendorRow = (key: string) => {
    const field = vendorFields.find((candidate) => candidate.key === key)!;
    const chosen = chosenVendor(field, subscription.config);
    const none = chosen === NONE;
    const isConnected = !none && connected(chosen);
    return (
      <Link
        key={key}
        prefetch={false}
        href={vendorPath(subscription.id, key)}
        data-testid={`flow-vendor-${key}`}
        aria-label={`${none ? "None" : nameOf(chosen)}: change the vendor`}
        // Its state — Connected, Not connected, or None's line — said too.
        aria-describedby={`flow-vendor-${key}-line`}
        className={`${CONNECTION_ROW} rounded-[var(--radius-md)] px-2 transition hover:bg-[var(--surface-hover)]`}
      >
        <ConnectionRowBody
          mark={
            none ? (
              <NoneMark />
            ) : (
              <ConnectionMark icon={providerById.get(chosen)?.icon} />
            )
          }
          name={none ? "None" : nameOf(chosen)}
          line={
            none
              ? "Save the details only."
              : isConnected
                ? "Connected"
                : "Not connected"
          }
          lineTone={none ? "muted" : isConnected ? "ok" : "warn"}
          lineId={`flow-vendor-${key}-line`}
          right={
            <CaretRightIcon
              aria-hidden
              size={16}
              className="shrink-0 text-[var(--muted)]"
            />
          }
        />
      </Link>
    );
  };

  // Step 1: the run's fields and Start run, or Turn on while the flow is off;
  // and what it is owed, each a link to where it is fixed.
  const stepOne = (
    <div id="run" className="mt-3 flex scroll-mt-6 flex-col gap-3">
      <RunStart
        workspaceId={workspaceId}
        subscriptionId={subscription.id}
        runInput={subscription.runInput ?? []}
        live={live}
        available={available}
        canGoLive={subscription.unmetConnections.length === 0}
        initialKey={newIdempotencyKey("run")}
      />
      {owed.map((line) => (
        <p key={line.key} className="text-xs text-[var(--warning-text)]">
          <Link
            prefetch={false}
            href={line.href}
            className="underline underline-offset-2"
          >
            {line.text}
          </Link>
        </p>
      ))}
    </div>
  );

  // Connections: every account the flow uses, in the manifest's order — then
  // any the platform says it is owed that the catalog does not name. One this
  // deployment does not list is named in Step 1 only.
  const used = [
    ...new Set([
      ...declared.map((connection) => connection.providerId),
      ...subscription.unmetConnections,
    ]),
  ].flatMap((providerId) => {
    const provider = providerById.get(providerId);
    return provider ? [provider] : [];
  });
  const counts =
    stats?.subscriptions.find(
      (candidate) => candidate.subscriptionId === subscription.id,
    ) ?? null;

  return (
    <SectionCard
      title={name}
      subheader={team}
      back={<BackLink href="/account/flows" />}
      primaryAction={<StatusPill status={subscription.status} />}
    >
      <section
        aria-labelledby="flow-dashboard-title"
        className="py-5 first:pt-0"
      >
        <h2
          id="flow-dashboard-title"
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          Dashboard
        </h2>
        <FlowDashboard
          workspaceId={workspaceId}
          subscriptionId={subscription.id}
          initial={counts}
          draft={subscription.status === "draft"}
        />
      </section>

      <section aria-labelledby="flow-steps-title" className="py-5">
        <h2
          id="flow-steps-title"
          tabIndex={-1}
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          Steps
        </h2>
        {!available && entry ? (
          // `available` is evidence from a reachability probe: saying so beats
          // a Start run that fails at once.
          <p className="mt-3 text-xs text-[var(--warning-text)]">
            This flow is not responding, so it cannot run yet.
          </p>
        ) : null}
        {plan.rows.length === 0 ? stepOne : null}
        <ol className="mt-3 flex flex-col divide-y divide-[var(--ring)]">
          {plan.rows.map((row) => (
            <li
              key={row.id}
              data-testid={`flow-step-${row.id}`}
              className="flex flex-col py-3"
            >
              <p className="text-sm font-medium text-[var(--text)]">
                {row.label}
              </p>
              <p className="text-xs text-[var(--muted)]">{row.sub}</p>
              {row.input ? stepOne : null}
              {row.vendorFields.length > 0 ? (
                <div className="mt-2">{row.vendorFields.map(vendorRow)}</div>
              ) : null}
            </li>
          ))}
        </ol>
        {/* A vendor choice its version places in no step (v2, from before
            `group`): under the steps. */}
        {plan.unplaced.length > 0 ? (
          <div className="mt-2 border-t border-[var(--ring)] pt-2">
            {plan.unplaced.map(vendorRow)}
          </div>
        ) : null}
      </section>

      {used.length > 0 ? (
        <section aria-labelledby="flow-connections-title" className="py-5">
          <h2
            id="flow-connections-title"
            className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
          >
            Connections
          </h2>
          <div className="mt-1">
            <ConnectionsPanel
              workspaceId={workspaceId}
              connections={connections.connections}
              providers={used}
              canManage={canManage}
              callbackStatus={
                callback === "connected" || callback === "error"
                  ? callback
                  : null
              }
              returnTo={flowPath(subscription.id)}
            />
          </div>
        </section>
      ) : null}

      <div className="py-5">
        <AutomationActions
          workspaceId={workspaceId}
          name={name}
          subscription={{ id: subscription.id, status: subscription.status }}
          // When the version it RUNS declares settings or accounts (the app's
          // M13) — never the catalog's newer one (backend §12.1 #185).
          setupHref={
            (subscription.setup ?? []).length > 0 || declared.length > 0
              ? setupPath(subscription.id)
              : null
          }
          newer={
            entry && subscription.templateVersion < entry.version
              ? {
                  from: subscription.templateVersion,
                  to: entry.version,
                  config: subscription.config,
                  targetSetup: entry.setup,
                }
              : null
          }
          webhook={subscription.triggerKind === "webhook" && canManage}
        />
      </div>
    </SectionCard>
  );
}
