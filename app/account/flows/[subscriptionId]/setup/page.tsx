import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  type AutomationSetupField,
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
  setupPath,
} from "@/lib/flow-steps";
import {
  administers,
  listWorkspaceProjects,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { placeOf } from "../../place";
import { SetupForm, type SetupVendorField } from "./SetupForm";

/**
 * Set up — ONE simple page, once, with everything on it (Build 21; the owner's
 * AM4 of 2026-10-15 ~22:15Z: "set up page is initial, after that flow page is
 * the run page. set up should be made simple. vendor connections can be
 * specific but everything is there … they can have a edit
 * settings/flow/setup thing in the bottom of the flow page in case they want
 * to change how it was set up"). Add opens it for the flow it added; the flow
 * page's "Edit setup" opens it again. ~~Set up, a dialog on the Flows card~~
 * until Build 21.
 *
 * Under its title the team the flow is in. Then, numbered: 1 · Connect — each
 * step's vendor choice (one `connection` field per step, backend ADR-0040),
 * drawn right here: each vendor the step names, then None; a tap chooses, and
 * a vendor not connected is connected first, for an owner or admin, through
 * its sign-in, which comes back here; then each account the flow cannot run
 * without, the one connection row with its Connect. Then its settings by the
 * manifest's sections, the title and the input only — no help line.
 *
 * One button: **Turn on** for a draft — everything on the page saved and the
 * flow turned on, in one press — or **Save** for a flow on or paused, which
 * keeps its status (the app's M2). Then the flow's page.
 */

export const dynamic = "force-dynamic";

export default async function SetupPage(
  props: PageProps<"/account/flows/[subscriptionId]/setup">,
) {
  const { subscriptionId } = await props.params;
  const { status } = await props.searchParams;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const [subscriptions, catalog, providers, connections, projects, role] =
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
      emptyWhenUnavailable(() => listWorkspaceProjects(workspaceId), []),
      roleInWorkspace(workspaceId),
    ]);

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

  // The settings of the version the flow RUNS, which the platform checks a
  // save against — not the catalog's newest (backend §12.1 #185).
  const setup: AutomationSetupField[] = subscription.setup ?? [];
  const declared = entry?.requiredConnections ?? [];
  const fields = connectionFields(setup);
  // An `optional` account is a step's to choose, or not (ADR-0037) — where
  // the version has the choice; the rest the flow cannot run without.
  const optional = new Set(
    fields.length > 0
      ? declared
          .filter((connection) => connection.optional)
          .map((connection) => connection.providerId)
      : [],
  );
  const providerById = new Map(
    providers.providers.map((provider) => [provider.providerId, provider]),
  );
  const vendorFields: SetupVendorField[] = fields.map((field) => ({
    key: field.key,
    title: field.title,
    saved: chosenVendor(field, subscription.config),
    options: fieldProviders(field, declared).map((connection) => {
      const provider = providerById.get(connection.providerId);
      return {
        providerId: connection.providerId,
        displayName: provider?.displayName ?? connection.displayName,
        icon: provider?.icon ?? null,
        connectable: provider?.authType === "oauth2",
        connection:
          connectionFor(connections.connections, connection.providerId) ?? null,
      };
    }),
  }));
  // Every account it cannot run without: what the catalog names, and what the
  // flow is still owed — a platform from before `requiredConnections` names
  // none, and the subscription still says.
  const required = [
    ...new Set([
      ...declared
        .filter((connection) => !optional.has(connection.providerId))
        .map((connection) => connection.providerId),
      ...subscription.unmetConnections.filter(
        (providerId) => !optional.has(providerId),
      ),
    ]),
  ].flatMap((providerId) => {
    const provider = providerById.get(providerId);
    return provider ? [provider] : [];
  });

  return (
    <SectionCard
      title={`Set up ${name}`}
      subheader={team}
      back={<BackLink href={flowPath(subscription.id)} />}
    >
      <SetupForm
        workspaceId={workspaceId}
        subscriptionId={subscription.id}
        status={subscription.status}
        available={entry?.available === true}
        setup={setup}
        config={subscription.config}
        vendorFields={vendorFields}
        required={required}
        connections={connections.connections}
        canManage={administers(role)}
        returnTo={setupPath(subscription.id)}
        callbackStatus={
          status === "connected" || status === "error" ? status : null
        }
      />
    </SectionCard>
  );
}
