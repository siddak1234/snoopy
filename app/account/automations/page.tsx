import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  type AutomationCatalogEntry,
  type Subscription,
} from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AutomationActions } from "./AutomationActions";
import { AddAutomation, type AddScope } from "./AddAutomation";
import { MoveVersionButton } from "./MoveVersionButton";
import { WebhookAddressButton } from "./WebhookAddressButton";
import {
  administers,
  listWorkspaceProjects,
  resolveActiveWorkspaceId,
  roleInWorkspace,
  type Project,
} from "@/lib/tenancy";

/**
 * The catalog, and what this workspace has done with it.
 *
 * Two reads rather than one because the server keeps them apart: the catalog is
 * global and says whether a workspace `subscribed`, while the subscription row
 * holds the status, the pinned version, and any unmet connections. Joining them
 * here is what lets one card show both "Added" and "Live".
 *
 * **One automation can hold a subscription per project** (backend 18.6.2): the
 * workspace-wide one and one for each project it was added to, each visible
 * only to the people who can see its project — the platform filters the list.
 * So a card lists every subscription it has, each under its own scope, rather
 * than one per template, which showed the oldest and hid the rest (register
 * F21).
 */

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);

  if (!workspaceId) {
    return (
      <SectionCard
        title="Automations"
        subheader="Browse automations and add them to your workspace"
      >
        <EmptyRow text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const [catalog, subscriptions, projects, role] = await Promise.all([
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    emptyWhenUnavailable(() => listWorkspaceProjects(workspaceId), []),
    roleInWorkspace(workspaceId),
  ]);
  const canAdminister = administers(role);

  // Archiving is one-way and is how a workspace gives a plan slot back; using
  // that automation again means subscribing afresh. The list's contract does not
  // promise to omit archived rows, so one is treated as absent here: its scope
  // is then offered to Add again.
  const byTemplate = new Map<string, Subscription[]>();
  for (const entry of subscriptions.subscriptions) {
    if (entry.status === "archived") continue;
    byTemplate.set(entry.templateId, [
      ...(byTemplate.get(entry.templateId) ?? []),
      entry,
    ]);
  }
  const openProjects = projects.filter(
    (project) => project.status !== "archived",
  );

  return (
    <SectionCard
      title="Automations"
      subheader="Browse automations and add them to your workspace"
    >
      {catalog.automations.length === 0 ? (
        <EmptyRow text="No automations are available yet." />
      ) : (
        <div className="grid gap-4 py-5 first:pt-0 sm:grid-cols-2">
          {catalog.automations.map((automation) => (
            <AutomationCard
              key={`${automation.templateId}.v${automation.version}`}
              automation={automation}
              subscriptions={byTemplate.get(automation.templateId) ?? []}
              projects={openProjects}
              canAdminister={canAdminister}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function AutomationCard({
  automation,
  subscriptions,
  projects,
  canAdminister,
}: {
  automation: AutomationCatalogEntry;
  subscriptions: Subscription[];
  projects: Project[];
  canAdminister: boolean;
}) {
  const projectName = new Map(
    projects.map((project) => [project.id, project.name]),
  );
  // Only the scopes this automation is not in yet: the platform holds one live
  // subscription per template and project, the whole workspace included.
  const taken = new Set(subscriptions.map((entry) => entry.projectId ?? null));
  const scopes: AddScope[] = [
    ...(taken.has(null) ? [] : [{ projectId: null, label: "Whole workspace" }]),
    ...projects
      .filter((project) => !taken.has(project.id))
      .map((project) => ({
        projectId: project.id,
        label: `Project: ${project.name}`,
      })),
  ];

  return (
    <div className="bubble flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.06em] text-[var(--muted)] uppercase">
            {automation.category}
          </p>
          {/* Where focus goes once a control that leaves the card is done —
              a move to the newest version takes its own button away. */}
          <h2
            id={`automation-${automation.templateId}-name`}
            tabIndex={-1}
            className="mt-1 truncate text-base font-medium text-[var(--text)]"
          >
            {automation.name}
          </h2>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">{automation.description}</p>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <div className="flex gap-1">
          <dt>Version</dt>
          <dd className="text-[var(--text)]">v{automation.version}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Price</dt>
          <dd className="text-[var(--text)]">
            {automation.monthlyPriceUsd === 0
              ? "Included"
              : `$${automation.monthlyPriceUsd}/mo`}
          </dd>
        </div>
      </dl>

      {/* `available` is evidence from a reachability probe. Saying so beats an
          Add button that fails at the first run. */}
      {!automation.available ? (
        <p className="text-xs text-[var(--warning-text)]">
          This automation is not responding, so it cannot run yet.
        </p>
      ) : null}

      {subscriptions.map((subscription) => (
        <div
          key={subscription.id}
          className="flex flex-col gap-2 border-t border-[var(--ring)] pt-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">
              {subscription.projectId
                ? `Project: ${projectName.get(subscription.projectId) ?? "a project"}`
                : "Whole workspace"}
            </p>
            <StatusPill status={subscription.status} />
          </div>

          {subscription.unmetConnections.length > 0 ? (
            <p className="text-xs text-[var(--warning-text)]">
              <Link
                prefetch={false}
                href="/account/connections"
                className="underline underline-offset-2"
              >
                Connect {subscription.unmetConnections.join(", ")}
              </Link>{" "}
              before going live.
            </p>
          ) : null}

          {/* A subscription runs the version it PINNED (backend ADR-0030), and
              adding an automation pins the newest. It moves in place (backend
              §12.1 #126); the catalog does not say what a newer version
              declares, so the card says only which version runs. */}
          {subscription.templateVersion < automation.version ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-[var(--muted)]">
                This runs v{subscription.templateVersion}; v{automation.version}{" "}
                is available.
              </p>
              <MoveVersionButton
                subscriptionId={subscription.id}
                name={automation.name}
                from={subscription.templateVersion}
                to={automation.version}
                focusAfter={`automation-${automation.templateId}-name`}
              />
            </div>
          ) : null}

          {/* Where a vendor sends the events that start it (backend §12.1 #91):
              only for a webhook-started version, and only for an owner or admin,
              as the platform allows no one else. */}
          {subscription.triggerKind === "webhook" && canAdminister ? (
            <div>
              <WebhookAddressButton subscriptionId={subscription.id} />
            </div>
          ) : null}

          <AutomationActions
            name={automation.name}
            available={automation.available}
            setup={automation.setup}
            subscription={{
              id: subscription.id,
              status: subscription.status,
              canGoLive: subscription.unmetConnections.length === 0,
              config: subscription.config,
              ...(subscription.runInput
                ? { runInput: subscription.runInput }
                : {}),
            }}
          />
        </div>
      ))}

      <div className="mt-auto">
        <AddAutomation
          templateId={automation.templateId}
          name={automation.name}
          available={automation.available}
          scopes={scopes}
        />
      </div>
    </div>
  );
}
