import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
} from "@/lib/automations";
import {
  emptyConnectionsWhenUnavailable,
  listConnectionProviders,
  listConnections,
} from "@/lib/connections";
import { connectionFor } from "@/lib/connection-rows";
import {
  chosenVendor,
  connectionFields,
  fieldProviders,
  flowPath,
} from "@/lib/flow-steps";
import {
  administers,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import type { VendorOption } from "../../VendorRows";
import { vendorPath } from "../../vendor-path";
import { VendorChoice } from "./VendorChoice";

/**
 * Connect integration (Build 22; ~~Connect vendor~~ until then) — one step's
 * vendor for one flow (the owner's build 19 item 1; backend ADR-0037,
 * ADR-0040; Build 21's A2), opened from the flow page's integration row with
 * `?field=` (the connection setting's key — a flow may choose one vendor per
 * step); without it, the flow's only one. Titled as the flow page's step 2
 * (the session's S21: one word for one thing; the owner's build 21 item 5:
 * "2. Connect integration … if i click that button it should take me to the
 * choices I have like none or quickbooks").
 *
 * **A tap is the choice, saved, and back to the flow** (the owner's build 20
 * item 2: "When i click one of the choices like none i shouldnt need to press
 * done or the back arrow. It should just take me back … and be saved"). Each
 * vendor is the one connection row (spec A4) with the check (24) on the
 * chosen one. ~~Save, Intuit's Connect button image and "Disconnect from
 * QuickBooks"~~ until Build 21 — disconnecting is Connections' (the session's
 * S13).
 */

export const dynamic = "force-dynamic";

export default async function VendorPage(
  props: PageProps<"/account/flows/[subscriptionId]/vendor">,
) {
  const { subscriptionId } = await props.params;
  const { status, field: fieldKey } = await props.searchParams;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const [subscriptions, catalog, providers, connections, role] =
    await Promise.all([
      emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
        subscriptions: [],
      }),
      emptyWhenUnavailable(() => listAutomations(workspaceId), {
        automations: [],
        categories: [],
      }),
      emptyConnectionsWhenUnavailable(listConnectionProviders, {
        providers: [],
      }),
      emptyConnectionsWhenUnavailable(() => listConnections(workspaceId), {
        connections: [],
      }),
      roleInWorkspace(workspaceId),
    ]);

  // A flow this person can see, with the choice the link names — or its only
  // one; any other id is the same "not found" a flow that does not exist is.
  const subscription = subscriptions.subscriptions.find(
    (candidate) =>
      candidate.id === subscriptionId && candidate.status !== "archived",
  );
  const fields = connectionFields(subscription?.setup ?? []);
  const field =
    typeof fieldKey === "string"
      ? fields.find((candidate) => candidate.key === fieldKey)
      : fields[0];
  const entry = catalog.automations.find(
    (candidate) => candidate.templateId === subscription?.templateId,
  );
  if (!subscription || !field || !entry) notFound();

  const providerById = new Map(
    providers.providers.map((provider) => [provider.providerId, provider]),
  );
  const options: VendorOption[] = fieldProviders(
    field,
    entry.requiredConnections,
  ).map((connection) => {
    const provider = providerById.get(connection.providerId);
    return {
      providerId: connection.providerId,
      displayName: provider?.displayName ?? connection.displayName,
      icon: provider?.icon ?? null,
      // OAuth only on this page: a pasted key is connected on Connections.
      connectable: provider?.authType === "oauth2",
      connection:
        connectionFor(connections.connections, connection.providerId) ?? null,
    };
  });

  return (
    <SectionCard
      title="Connect integration"
      subheader={`For ${subscription.name ?? entry.name}`}
      back={<BackLink href={flowPath(subscription.id)} />}
    >
      <VendorChoice
        workspaceId={workspaceId}
        subscriptionId={subscription.id}
        field={field.key}
        saved={chosenVendor(field, subscription.config)}
        options={options}
        canManage={administers(role)}
        returnTo={vendorPath(subscription.id, field.key)}
        callbackStatus={
          status === "connected" || status === "error" ? status : null
        }
      />
    </SectionCard>
  );
}
