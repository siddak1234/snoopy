import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  readFlowEmailRecipients,
  readRunStats,
  type AutomationSetupField,
  type FlowEmailRecipients,
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
import { BackLink } from "@/components/dashboard/BackLink";
import {
  CONNECTION_ROW,
  ConnectionMark,
  ConnectionRowBody,
  GlyphMark,
  NoneMark,
} from "@/components/dashboard/ConnectionRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AutomationActions } from "../AutomationActions";
import { FlowDashboard } from "../FlowDashboard";
import { RunStart } from "../RunStart";
import { placeOf } from "../place";
import { owedLines, vendorPath } from "../vendor-path";

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
 * ~~Connections~~ ("Remove the connections in the bottom as well") and ~~the
 * move to a newer version~~ ("I also dont want a move to vx number in the
 * flows. The user always gets the latest version") until Build 22 (the
 * owner's build 21 item 7): the platform moves every flow to the newest
 * version (backend ADR-0041), and Disconnect stays on Connections.
 *
 * Opened from its card on Flows (Open).
 */

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
      className={`${CONNECTION_ROW} mt-2 rounded-[var(--radius-md)] px-2 transition hover:bg-[var(--surface-hover)]`}
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
        {plan.length === 0 ? stepOne : null}
        <ol className="mt-3 flex flex-col divide-y divide-[var(--ring)]">
          {plan.map((row) => (
            <li
              key={row.id}
              data-testid={`flow-step-${row.id}`}
              className="flex flex-col py-3"
            >
              {/* The step's title only — no line under it (the session's
                  S20; P2: "After step 4 i dont want to see quickbooks"). */}
              <p className="text-sm font-medium text-[var(--text)]">
                {row.label}
              </p>
              {row.input ? stepOne : null}
              {row.kind === "setting" && row.fields.length > 0 ? (
                <div className="mt-2">{row.fields.map(vendorRow)}</div>
              ) : null}
              {row.kind === "email" ? emailRow : null}
            </li>
          ))}
        </ol>
      </section>

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
          webhook={subscription.triggerKind === "webhook" && canManage}
        />
      </div>
    </SectionCard>
  );
}
