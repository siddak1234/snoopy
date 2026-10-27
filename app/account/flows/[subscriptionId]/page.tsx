import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listItems,
  listSubscriptions,
  readFlowEmailRecipients,
  readRunStats,
  type AutomationSetupField,
  type FlowEmailRecipients,
  type ListItemsResponse,
} from "@/lib/automations";
import {
  emptyConnectionsWhenUnavailable,
  listConnectionProviders,
  listConnections,
} from "@/lib/connections";
import { connectionFor, connectionState } from "@/lib/connection-rows";
import { EMAIL_UNAVAILABLE, emailPath, recipientsLine } from "@/lib/flow-email";
import {
  NONE,
  NONE_LABEL,
  chosenVendor,
  connectionFields,
  flowStepPlan,
  setupPath,
} from "@/lib/flow-steps";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
  newIdempotencyKey,
} from "@/lib/platform-server";
import {
  administers,
  listWorkspaceProjects,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { Group } from "@/components/dashboard/Group";
import { SPACING } from "@/lib/spacing";
import { BackLink } from "@/components/dashboard/BackLink";
import {
  CONNECTION_ROW,
  ConnectionMark,
  ConnectionRowBody,
  GlyphMark,
  NoneMark,
} from "@/components/dashboard/ConnectionRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Fallback } from "@/components/blocks/Fallback";
import { pageParts } from "@/components/blocks/look";
import { AutomationActions } from "../AutomationActions";
import { FlowDashboard } from "../FlowDashboard";
import { FlowItems } from "../FlowItems";
import { RunStart } from "../RunStart";
import { placeOf } from "../place";
import { owedLines, vendorPath } from "../vendor-path";

/** A step's link row (an integration, the email): the table's row padding, lit on hover. */
const LINK_ROW = `rounded-[var(--radius-md)] ${SPACING.rowX.x} transition hover:bg-[var(--surface-hover)]`;

/**
 * A flow's page — the run page for a flow (Build 21, spec A6; the owner's AM4
 * of 2026-10-15: "set up page is initial, after that flow page is the run
 * page"), with Build 22's steps (P1–P4; the owner's build 21 items 5–7) — the
 * app's flow page on the website (D5, the session's suggestion the owner
 * approved 21:12Z). Top to bottom:
 *
 * 1. its name, its status and its team — no description (the session's S24);
 * 2. **Dashboard** — Runs, Successes, Failures, live (`FlowDashboard`);
 * 3. **Steps** — numbered, titles only (the session's S20): "1 · Upload
 *    invoice" holds the document and Start run (Turn on while it is off) and
 *    what the flow is owed; "2 · Connect integration" holds the integration
 *    row — its mark, its name, "Connected" or "Not connected", or None — which
 *    opens the choices; "3 · AI processing"; "4 · QuickBooks updated" or
 *    "Details saved", by the flow's choice, nothing under it; "5 · Email
 *    sent", the first address and how many more, which opens who gets the
 *    email (`flowStepPlan`'s kinds, backend ADR-0041). Settings are edited on
 *    Set up, through Edit setup, as in the app (its M3);
 * 4. at the bottom: Pause, **Edit setup**, the webhook address, Archive.
 *
 * **A flow with items** (Round 19, plan §5.1; backend ADR-0046) — what the
 * version it runs declares as `items` — has no Dashboard and no Steps (plan
 * §3; the owner's build 28 items 2 and 3: "It should just be upload
 * candidate and jobs"): its items are the page (`FlowItems`), since its runs
 * each name an item and start on the item's page. What Step 1 held besides
 * the run form stays above them, with no heading: Turn on while it is off,
 * "This flow is not responding" and what it is owed. Its items are read with
 * the page; a list that cannot be read is "Unavailable", never the page.
 * ~~Its items after its steps, Step 1 holding Turn on~~ until build 28.
 *
 * ~~Connections~~ ("Remove the connections in the bottom as well") and ~~the
 * move to a newer version~~ ("I also dont want a move to vx number in the
 * flows. The user always gets the latest version") until Build 22 (the
 * owner's build 21 item 7): the platform moves every flow to the newest
 * version (backend ADR-0041), and Disconnect stays on Connections.
 *
 * Its parts — Dashboard, Steps, items — come in the order its flow's
 * manifest gives (`Subscription.pages.flow`, backend ADR-0048), else in
 * today's; a part this build does not know draws the fallback sentence.
 *
 * Opened from its card on Flows (Open).
 */

/**
 * A flow's items, or null when the platform cannot say — "Unavailable", as
 * Step 5's addresses, never an empty list a flow with items does not have.
 */
async function readItems(
  workspaceId: string,
  subscriptionId: string,
): Promise<ListItemsResponse | null> {
  try {
    return await listItems(workspaceId, subscriptionId);
  } catch (error) {
    if (
      error instanceof PlatformServerError ||
      error instanceof PlatformNotConfiguredError
    )
      return null;
    throw error;
  }
}

/**
 * Step 5's addresses (Build 22, the session's S22): who gets this flow's run
 * emails, read on the server each time the page is drawn — so a change made on
 * the email page shows on return. A read that fails costs the row its address
 * ("Unavailable"), never the page.
 */
async function readRecipients(
  workspaceId: string,
  subscriptionId: string,
): Promise<FlowEmailRecipients | null> {
  try {
    return await readFlowEmailRecipients(workspaceId, subscriptionId);
  } catch (error) {
    if (
      error instanceof PlatformServerError ||
      error instanceof PlatformNotConfiguredError
    )
      return null;
    throw error;
  }
}

export const dynamic = "force-dynamic";

export default async function FlowPage(
  props: PageProps<"/account/flows/[subscriptionId]">,
) {
  const { subscriptionId } = await props.params;
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
    recipients,
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
    readRecipients(workspaceId, subscriptionId),
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
  // The items the version it RUNS declares (backend ADR-0046), as its setup.
  const declaredItems = subscription.items;
  const items = declaredItems
    ? await readItems(workspaceId, subscription.id)
    : undefined;
  const available = entry?.available === true;
  const providerById = new Map(
    providers.providers.map((provider) => [provider.providerId, provider]),
  );
  const connected = (providerId: string) =>
    connectionState(connectionFor(connections.connections, providerId)) ===
    "connected";

  // Each step's vendor choice (backend ADR-0040), from the version the flow
  // RUNS — none when it declares none — never the catalog's newer one
  // (backend §12.1 #185), as its Set up and its Connect integration page read it:
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
  // for; a flow on another version gets its steps by title. Since Build 22
  // every flow is moved to the newest version (backend ADR-0041), so the two
  // differ only for a flow the platform could not move (the app's M5).
  const plan = flowStepPlan(
    entry?.pipeline,
    entry?.version === subscription.templateVersion ? entry.groups : undefined,
    setup,
    subscription.config,
  );

  /** A setting step's integration: its mark, its name, its state — the whole row opens the choices (A3). */
  const vendorRow = (key: string) => {
    const field = vendorFields.find((candidate) => candidate.key === key);
    // A setting step's other fields (an amount, a text) are edited on Set up,
    // not drawn here (the app's M1).
    if (!field) return null;
    const chosen = chosenVendor(field, subscription.config);
    const none = chosen === NONE;
    const isConnected = !none && connected(chosen);
    return (
      <Link
        key={key}
        prefetch={false}
        href={vendorPath(subscription.id, key)}
        data-testid={`flow-vendor-${key}`}
        aria-label={`${none ? "None" : nameOf(chosen)}: change the integration`}
        // Its state — Connected, Not connected, or None's line — said too.
        aria-describedby={`flow-vendor-${key}-line`}
        className={`${CONNECTION_ROW} ${LINK_ROW}`}
      >
        <ConnectionRowBody
          mark={
            none ? (
              <NoneMark />
            ) : (
              <ConnectionMark icon={providerById.get(chosen)?.icon} />
            )
          }
          name={none ? NONE_LABEL : nameOf(chosen)}
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

  // `available` is evidence from a reachability probe: saying so beats a
  // Start run that fails at once.
  const notResponding =
    !available && entry ? (
      <p className="text-xs text-[var(--warning-text)]">
        This flow is not responding, so it cannot run yet.
      </p>
    ) : null;

  // Step 1: the run's fields and Start run, or Turn on while the flow is off;
  // and what it is owed, each a link to where it is fixed.
  const stepOne = (
    <div id="run" className={`flex scroll-mt-6 flex-col ${SPACING.inner.gap}`}>
      <RunStart
        workspaceId={workspaceId}
        subscriptionId={subscription.id}
        // A flow with items starts its runs on an item's page: Turn on only.
        runInput={declaredItems ? [] : (subscription.runInput ?? [])}
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

  // Step 5: who gets the run's email — the first address listed and how many
  // more (the session's S22), a press from the page that changes it.
  // Unreadable, "Unavailable", and it still opens.
  const emailLine = recipients
    ? recipientsLine(recipients)
    : { first: EMAIL_UNAVAILABLE, more: null };
  const emailRow = (
    <Link
      prefetch={false}
      href={emailPath(subscription.id)}
      data-testid="flow-email"
      className={`${CONNECTION_ROW} ${LINK_ROW}`}
    >
      <ConnectionRowBody
        mark={<GlyphMark icon={EnvelopeSimpleIcon} />}
        name={emailLine.first}
        line={emailLine.more}
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
  const counts =
    stats?.subscriptions.find(
      (candidate) => candidate.subscriptionId === subscription.id,
    ) ?? null;

  // The page's parts in the order its flow's manifest gives them
  // (`Subscription.pages.flow`, backend ADR-0048), else today's: a flow with
  // items its items, any other its Dashboard and its Steps. A part this
  // build does not know draws the fallback.
  const parts = pageParts(
    subscription.pages?.flow,
    ["dashboard", "steps", "items"] as const,
    declaredItems ? ["items"] : ["dashboard", "steps"],
  );
  const part = (name: (typeof parts)[number], at: number) => {
    if (name === "dashboard")
      return (
        <Group key="dashboard" title="Dashboard" titleId="flow-dashboard-title">
          <FlowDashboard
            workspaceId={workspaceId}
            subscriptionId={subscription.id}
            initial={counts}
            draft={subscription.status === "draft"}
          />
        </Group>
      );
    if (name === "steps")
      return (
        <Group
          key="steps"
          title="Steps"
          titleId="flow-steps-title"
          titleTabIndex={-1}
        >
          <div className={`flex flex-col ${SPACING.inner.gap}`}>
            {notResponding}
            {plan.length === 0 ? stepOne : null}
            <ol className="flex flex-col divide-y divide-[var(--ring)]">
              {plan.map((row) => (
                <li
                  key={row.id}
                  data-testid={`flow-step-${row.id}`}
                  className={`flex flex-col ${SPACING.inner.gap} ${SPACING.rowY.y}`}
                >
                  {/* The step's title only — no line under it (the session's
              S20; P2: "After step 4 i dont want to see quickbooks"). */}
                  <p className="text-sm font-medium text-[var(--text)]">
                    {row.label}
                  </p>
                  {row.input ? stepOne : null}
                  {row.kind === "setting" && row.fields.length > 0 ? (
                    <div>{row.fields.map(vendorRow)}</div>
                  ) : null}
                  {row.kind === "email" ? emailRow : null}
                </li>
              ))}
            </ol>
          </div>
        </Group>
      );
    if (name === "items")
      return (
        <div key="items" className="contents">
          {/* A flow with items: no Dashboard and no Steps (build 28's items
              2 and 3). Turn on, the probe's line and what it is owed, only
              when there is one of them to say and no Steps say it. */}
          {!parts.includes("steps") &&
          (!live || owed.length > 0 || notResponding) ? (
            <Group>
              <div className={`flex flex-col ${SPACING.inner.gap}`}>
                {notResponding}
                {stepOne}
              </div>
            </Group>
          ) : null}
          {declaredItems && items !== undefined ? (
            <FlowItems
              workspaceId={workspaceId}
              subscriptionId={subscription.id}
              declared={declaredItems}
              initial={items}
              canManage={canManage}
            />
          ) : null}
        </div>
      );
    return (
      <Group key={`unknown-${at}`}>
        <Fallback />
      </Group>
    );
  };

  return (
    <SectionCard
      title={name}
      subheader={team}
      back={<BackLink href="/account/flows" />}
      primaryAction={<StatusPill status={subscription.status} />}
    >
      {parts.map(part)}

      <Group>
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
          webhook={subscription.triggerKind === "webhook" && canManage}
        />
      </Group>
    </SectionCard>
  );
}
