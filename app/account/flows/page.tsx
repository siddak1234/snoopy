import Link from "next/link";
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
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AutomationActions } from "./AutomationActions";
import { AddAutomation, type AddScope } from "./AddAutomation";
import { MoveVersionButton } from "./MoveVersionButton";
import { WebhookAddressButton } from "./WebhookAddressButton";
import {
  administers,
  teamDirectoryIfThere,
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
 * **One flow can be added once per team** (backend 18.6.2; a team is a project
 * in the platform's contract): one for each team it was added to, each visible
 * only to the people who can see its team — the platform filters the list. So a
 * card lists every subscription it has, each under its own scope, rather than
 * one per template, which showed the oldest and hid the rest (register F21).
 *
 * **A flow is added to a team** (the owner, build 10): the whole workspace is
 * no longer offered, and with no team yet nothing can be added — an owner or
 * admin is sent to make one. The platform is unchanged: a flow added to the
 * whole workspace before stays, listed and labelled "Whole workspace".
 *
 * Archived flows are read by name (`status=archived`, backend §12.1 #203) and
 * listed last, each with the day it was archived (BUILD-PLAN 24.11.11).
 */

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);

  if (!workspaceId) {
    return (
      <SectionCard
        title="Flows"
        subheader="Browse flows and add them to your workspace"
      >
        <EmptyRow text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const [catalog, subscriptions, archived, projects, role] = await Promise.all([
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    emptyWhenUnavailable(() => listArchivedSubscriptions(workspaceId), []),
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
  // A plain member on no team (the owner's build 10, found by the change
  // audit): if the organization has teams they could ask to join, the card
  // says so rather than that the first team is still to be made. Read only in
  // that state; an owner or admin sees every team already.
  const canAskToJoin =
    !canAdminister && openProjects.length === 0
      ? (await teamDirectoryIfThere(workspaceId)).some(
          (entry) => entry.access !== "member",
        )
      : false;
  const catalogName = new Map(
    catalog.automations.map((entry) => [entry.templateId, entry.name]),
  );
  // An archived flow keeps the team it was in, deleted or not. A team is its
  // kind (the owner, build 9).
  const teamName = new Map(
    projects.map((project) => [project.id, project.type]),
  );

  return (
    <SectionCard
      title="Flows"
      subheader="Browse flows and add them to your workspace"
    >
      {catalog.automations.length === 0 ? (
        // The whole page is empty: the app's empty screen, in its words (the
        // owner, build 10). There is nowhere to go until the catalog has one.
        <EmptyRow
          icon={<FlowArrowIcon size={32} />}
          title="No flows to add yet"
          text="More are on the way."
        />
      ) : (
        <div className="grid gap-4 py-5 first:pt-0 sm:grid-cols-2">
          {catalog.automations.map((automation) => (
            <AutomationCard
              key={`${automation.templateId}.v${automation.version}`}
              automation={automation}
              subscriptions={byTemplate.get(automation.templateId) ?? []}
              projects={openProjects}
              canAdminister={canAdminister}
              canAskToJoin={canAskToJoin}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <div className="border-t border-[var(--ring)] py-5">
          <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Archived flows
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            An archived flow keeps its history here. Add it again any time.
          </p>
          <ul className="mt-3 divide-y divide-[var(--ring)]">
            {archived.map((subscription) => (
              <li
                key={subscription.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text)]">
                    {subscription.name ??
                      catalogName.get(subscription.templateId) ??
                      subscription.templateId}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {subscription.projectId
                      ? `Team: ${teamName.get(subscription.projectId) ?? "a team"}`
                      : "Whole workspace"}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  Archived {formatDay(subscription.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

function AutomationCard({
  automation,
  subscriptions,
  projects,
  canAdminister,
  canAskToJoin,
  workspaceId,
}: {
  automation: AutomationCatalogEntry;
  subscriptions: Subscription[];
  projects: Project[];
  canAdminister: boolean;
  /** A plain member on no team, in an organization with a team they could ask to join. */
  canAskToJoin: boolean;
  /** The workspace this page shows; every action on the card is refused once it is not active. */
  workspaceId: string;
}) {
  // A team is its kind (the owner, build 9).
  const projectName = new Map(
    projects.map((project) => [project.id, project.type]),
  );
  // Only the teams this automation is not in yet: the platform holds one live
  // subscription per template and project. The whole workspace is not offered
  // (the owner, build 10) — a row added there before keeps its place above.
  const taken = new Set(subscriptions.map((entry) => entry.projectId ?? null));
  const scopes: AddScope[] = projects
    .filter((project) => !taken.has(project.id))
    .map((project) => ({
      projectId: project.id,
      label: `Team: ${project.type}`,
    }));

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
          This flow is not responding, so it cannot run yet.
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
                ? `Team: ${projectName.get(subscription.projectId) ?? "a team"}`
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
                workspaceId={workspaceId}
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
              <WebhookAddressButton
                workspaceId={workspaceId}
                subscriptionId={subscription.id}
              />
            </div>
          ) : null}

          <AutomationActions
            workspaceId={workspaceId}
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
          workspaceId={workspaceId}
          templateId={automation.templateId}
          name={automation.name}
          available={automation.available}
          scopes={scopes}
          hasTeam={projects.length > 0}
          canAdminister={canAdminister}
          canAskToJoin={canAskToJoin}
        />
      </div>
    </div>
  );
}
