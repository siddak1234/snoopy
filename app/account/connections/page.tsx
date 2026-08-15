import SectionCard from "@/components/dashboard/SectionCard";
import { getAppSession } from "@/lib/app-session";
import {
  emptyConnectionsWhenUnavailable,
  listConnectionProviders,
  listConnections,
} from "@/lib/connections";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import { ConnectionsPanel } from "./ConnectionsPanel";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: PageProps<"/account/connections">) {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  const { status } = await searchParams;

  if (!workspaceId) {
    return (
      <SectionCard
        title="Connections"
        subheader="Connect the accounts your automations use"
      >
        <p className="py-5 text-sm text-[var(--muted)]">
          No workspace is active yet.
        </p>
      </SectionCard>
    );
  }

  const [providers, connections] = await Promise.all([
    emptyConnectionsWhenUnavailable(listConnectionProviders, { providers: [] }),
    emptyConnectionsWhenUnavailable(() => listConnections(workspaceId), {
      connections: [],
    }),
  ]);

  return (
    <SectionCard
      title="Connections"
      subheader="Connect the accounts your automations use"
    >
      <ConnectionsPanel
        connections={connections.connections}
        providers={providers.providers}
        callbackStatus={
          status === "connected" || status === "error" ? status : null
        }
      />
    </SectionCard>
  );
}
