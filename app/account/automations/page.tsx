import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  type AutomationCatalogEntry,
  type Subscription,
} from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AutomationActions } from "./AutomationActions";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * The catalog, and what this workspace has done with it.
 *
 * Two reads rather than one because the server keeps them apart: the catalog is
 * global and says whether a workspace `subscribed`, while the subscription row
 * holds the status, the pinned version, and any unmet connections. Joining them
 * here is what lets one card show both "Added" and "Live".
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

  const [catalog, subscriptions] = await Promise.all([
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
  ]);

  const byTemplate = new Map<string, Subscription>(
    subscriptions.subscriptions.map((entry) => [entry.templateId, entry]),
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
              subscription={byTemplate.get(automation.templateId)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function AutomationCard({
  automation,
  subscription,
}: {
  automation: AutomationCatalogEntry;
  subscription: Subscription | undefined;
}) {
  return (
    <div className="bubble flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.06em] text-[var(--muted)] uppercase">
            {automation.category}
          </p>
          <h2 className="mt-1 truncate text-base font-medium text-[var(--text)]">
            {automation.name}
          </h2>
        </div>
        {subscription ? <StatusPill status={subscription.status} /> : null}
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

      {subscription && subscription.unmetConnections.length > 0 ? (
        <p className="text-xs text-[var(--warning-text)]">
          Connect {subscription.unmetConnections.join(", ")} before going live.
        </p>
      ) : null}

      <AutomationActions
        templateId={automation.templateId}
        available={automation.available}
        setup={automation.setup}
        subscription={
          subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                canGoLive: subscription.unmetConnections.length === 0,
                config: subscription.config,
              }
            : null
        }
      />
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="py-5 first:pt-0">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}
