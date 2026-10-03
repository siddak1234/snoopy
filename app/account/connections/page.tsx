import SectionCard from "@/components/dashboard/SectionCard";
import { getAppSession } from "@/lib/app-session";
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
        subheader="Connect the accounts your flows use"
      >
        <p className="py-5 text-sm text-[var(--muted)]">
          No workspace is active yet.
        </p>
      </SectionCard>
    );
  }

  const [providers, connections, role] = await Promise.all([
    emptyConnectionsWhenUnavailable(listConnectionProviders, { providers: [] }),
    emptyConnectionsWhenUnavailable(() => listConnections(workspaceId), {
      connections: [],
    }),
    roleInWorkspace(workspaceId),
  ]);

  return (
    <SectionCard
      title="Connections"
      subheader="Connect the accounts your flows use"
    >
      <ConnectionsPanel
        workspaceId={workspaceId}
        connections={connections.connections}
        providers={providers.providers}
        canManage={administers(role)}
        callbackStatus={
          status === "connected" || status === "error" ? status : null
        }
      />
    </SectionCard>
  );
}
