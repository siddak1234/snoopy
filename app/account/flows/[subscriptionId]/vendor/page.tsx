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
import {
  administers,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { VendorChoice, type VendorOption } from "./VendorChoice";

/**
 * A flow's Connect vendor page (spec §3.C; backend ADR-0037; the owner's
 * build-19 feedback #1: "There should be a connect vendor button and takes it
 * to a page specific for this flows vendors. If already connected you can
 * choose which vendor or just a none."). Each vendor the flow may use — its
 * optional connections, in the manifest's order — with its logo, and None last;
 * the choice is the flow's `connection` setting, saved here.
 *
 * Connecting is an owner's or an admin's (it changes the account every flow in
 * the workspace acts through): they see the vendor's own connect button, and a
 * member is told who connects it. A vendor not connected is chosen once its
 * connect returns.
 */

export const dynamic = "force-dynamic";

export default async function VendorPage(
  props: PageProps<"/account/flows/[subscriptionId]/vendor">,
) {
  const { subscriptionId } = await props.params;
  const { status } = await props.searchParams;
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

  // A flow this person can see, that has a vendor to choose; any other id is
  // the same "not found" a flow that does not exist is.
  const subscription = subscriptions.subscriptions.find(
    (candidate) =>
      candidate.id === subscriptionId && candidate.status !== "archived",
  );
  const field = subscription?.setup?.find(
    (candidate) => candidate.control === "connection",
  );
  const entry = catalog.automations.find(
    (candidate) => candidate.templateId === subscription?.templateId,
  );
  if (!subscription || !field || !entry) notFound();

  const providerById = new Map(
    providers.providers.map((provider) => [provider.providerId, provider]),
  );
  const options: VendorOption[] = entry.requiredConnections
    .filter((connection) => connection.optional)
    .map((connection) => {
      const provider = providerById.get(connection.providerId);
      const live = connections.connections.find(
        (candidate) =>
          candidate.providerId === connection.providerId &&
          candidate.status === "connected",
      );
      return {
        providerId: connection.providerId,
        displayName: provider?.displayName ?? connection.displayName,
        icon: provider?.icon ?? null,
        // OAuth only on this page: a pasted key is connected on Connections.
        connectable: provider?.authType === "oauth2",
        connectionId: live?.id ?? null,
      };
    });
  const saved = subscription.config[field.key] ?? field.defaultValue ?? "none";

  return (
    <SectionCard
      title="Connect vendor"
      subheader={`For ${subscription.name ?? entry.name}`}
    >
      <VendorChoice
        workspaceId={workspaceId}
        subscriptionId={subscription.id}
        saved={typeof saved === "string" ? saved : "none"}
        options={options}
        canManage={administers(role)}
        callbackStatus={
          status === "connected" || status === "error" ? status : null
        }
      />
    </SectionCard>
  );
}
