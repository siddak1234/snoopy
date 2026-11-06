import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  readHealthDataAgreement,
  readWorkspaceHealthDataAgreement,
  type HealthDataAgreement,
  type WorkspaceHealthDataAgreement,
} from "@/lib/agreements";
import {
  emptyWhenUnavailable,
  listAutomations,
  readSubscription,
  type AutomationSetupField,
} from "@/lib/automations";
import {
  emptyConnectionsWhenUnavailable,
  listConnectionProviders,
  listConnections,
} from "@/lib/connections";
import { connectionFor, isKeyless } from "@/lib/connection-rows";
import {
  chosenVendor,
  connectionFields,
  fieldProviders,
  flowPath,
  setupPath,
} from "@/lib/flow-steps";
import { contractStep } from "@/lib/health-agreement";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
} from "@/lib/platform-server";
import {
  administers,
  listWorkspaceProjects,
  listWorkspaces,
  resolveActiveWorkspaceId,
  roleInWorkspace,
  type WorkspaceRole,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { placeOf } from "../../place";
import type { ContractView } from "./ContractStep";
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
 * manifest's sections, the title and the input only — no help line: its own
 * `setupSections` when it declares them, each vendor choice in the section it
 * names (backend ADR-0048 amendment 5), else the four fixed ones.
 *
 * A flow that carries health data (`AutomationCatalogEntry.healthData`) then
 * draws "Contract and accept" (`ContractStep`; the owner's item 9 of builds 37
 * and 39; backend ADR-0049 amendment 2), from what is read here for an owner
 * or admin: the workspace's agreement and, for the owner while it is not
 * accepted, the text to sign (`readContract`). A member is not read (the
 * platform answers 403) and is asked to ask the owner. A read that fails says
 * "Unavailable" in the section, never the page.
 *
 * One button: **Turn on** for a draft — everything on the page saved and the
 * flow turned on, in one press, the agreement accepted first when the owner
 * signs it here — or **Save** for a flow on or paused, which keeps its status
 * (the app's M2). Then the flow's page.
 */

export const dynamic = "force-dynamic";

/** A read the platform refused or could not answer: the section says "Unavailable". */
const unread = (error: unknown) =>
  error instanceof PlatformServerError ||
  error instanceof PlatformNotConfiguredError;

/**
 * The "Contract and accept" section's view, for a flow that carries health
 * data: read for an owner or admin only, the text only for the owner while
 * the current version is not accepted (`contractStep`).
 */
async function readContract(
  workspaceId: string,
  role: WorkspaceRole | undefined,
): Promise<ContractView> {
  let read: WorkspaceHealthDataAgreement | null = null;
  let text: HealthDataAgreement | "unpublished" | null = null;
  let readFailed = false;
  let organization = "";
  try {
    if (administers(role)) {
      read = await readWorkspaceHealthDataAgreement(workspaceId);
      if (role === "owner" && read.current && !read.acceptance) {
        organization =
          (await listWorkspaces()).find((entry) => entry.id === workspaceId)
            ?.name ?? "";
        text = (await readHealthDataAgreement()) ?? "unpublished";
      }
    }
  } catch (error) {
    if (!unread(error)) throw error;
    readFailed = true;
  }
  const state = contractStep({
    role,
    healthData: true,
    read,
    text,
    readFailed,
  });
  const acceptance = read?.acceptance ?? null;
  return {
    state: state === "hidden" ? "unavailable" : state,
    organization,
    offer: state === "sign" && text && text !== "unpublished" ? text : null,
    acceptance:
      state === "accepted" && acceptance
        ? {
            version: acceptance.version,
            signerName: acceptance.signerName,
            signerTitle: acceptance.signerTitle,
            acceptedAt: acceptance.acceptedAt,
          }
        : null,
    today: new Date().toISOString(),
  };
}

export default async function SetupPage(
  props: PageProps<"/account/flows/[subscriptionId]/setup">,
) {
  const { subscriptionId } = await props.params;
  const { status } = await props.searchParams;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const [subscription, catalog, providers, connections, projects, role] =
    await Promise.all([
      emptyWhenUnavailable(
        () => readSubscription(workspaceId, subscriptionId),
        null,
      ),
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

  // The flow by its id, with the settings of the version it pins (backend
  // §12.1 #319); archived or not this person's is "not found".
  if (!subscription || subscription.status === "archived") notFound();
  const entry = catalog.automations.find(
    (candidate) => candidate.templateId === subscription.templateId,
  );
  const name = subscription.name ?? entry?.name ?? subscription.templateId;
  const contract = entry?.healthData
    ? await readContract(workspaceId, role)
    : null;
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
        authType: provider?.authType,
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
    // A public service needs no connect step (platform round 2's B5).
    return provider && !isKeyless(provider.authType) ? [provider] : [];
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
        sections={subscription.setupSections}
        config={subscription.config}
        vendorFields={vendorFields}
        required={required}
        connections={connections.connections}
        canManage={administers(role)}
        returnTo={setupPath(subscription.id)}
        callbackStatus={
          status === "connected" || status === "error" ? status : null
        }
        contract={contract}
      />
    </SectionCard>
  );
}
