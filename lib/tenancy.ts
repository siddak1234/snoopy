import { cache } from "react";
import { getAppSession } from "@/lib/app-session";
import {
  newIdempotencyKey,
  platformServerJson,
  PlatformServerError,
  workspacePath,
} from "@/lib/platform-server";
import type { components } from "@/lib/generated/platform-contracts/platform";

type Schema = components["schemas"];

export type Workspace = Schema["WorkspaceSummary"];
export type WorkspaceMember = Schema["WorkspaceMember"];
export type WorkspaceRole = Workspace["role"];
export type Project = Schema["ProjectSummary"];
export type ProjectMembership = Schema["ProjectMembership"];
export type ProjectRole = ProjectMembership["role"];
export type ProjectStatus = Project["status"];
export type OrganizationDomain = Schema["OrganizationDomain"];
export type OrganizationDomainJoinPolicy = OrganizationDomain["joinPolicy"];
export type OrganizationJoinRequest = Schema["OrganizationJoinRequest"];
export type OrganizationJoinRequestDecision =
  Schema["DecideOrganizationJoinRequest"]["decision"];
export type DiscoverableOrganization = Schema["DiscoverableOrganization"];
/** A team in the organization's directory, and where this person stands with it (backend 24.11.4). */
export type TeamDirectoryEntry = Schema["ProjectDirectoryEntry"];
/** A request to join a team (backend 24.11.2). */
export type AccessRequest = Schema["ProjectAccessRequest"];

function projectPath(workspaceId: string, projectId: string): string {
  return `${workspacePath(workspaceId)}/projects/${encodeURIComponent(projectId)}`;
}

/** Cursors are opaque values: this only encodes them for HTTP transport. */
function withCursor(path: string, cursor: string | undefined): string {
  return cursor === undefined
    ? path
    : `${path}?cursor=${encodeURIComponent(cursor)}`;
}

async function collectPages<T>(
  readPage: (cursor: string | undefined) => Promise<{
    items: T[];
    nextCursor?: string;
  }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await readPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  return items;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const response = await listWorkspaceCollection();
  return response.workspaces;
}

/**
 * **Read once per request** (register F27), as the session is: the account
 * layout and the page it wraps both need the workspace list, and each ask was a
 * separate Edge request charged to the person's own rate bucket (backend
 * ADR-0029).
 */
const listWorkspaceCollection = cache(
  async (): Promise<Schema["WorkspaceListResponse"]> =>
    platformServerJson<Schema["WorkspaceListResponse"]>("/v1/workspaces"),
);

/**
 * The active workspace ID is authoritative when the session provides one.
 * Otherwise, use the collection response's declared active workspace. The
 * contract does not declare an ordering that lets the client choose a fallback.
 */
export async function resolveActiveWorkspaceId(
  session: { user: { workspaceId?: string } } | null | undefined,
): Promise<string | undefined> {
  return (
    session?.user.workspaceId ??
    (await listWorkspaceCollection()).activeWorkspaceId
  );
}

/**
 * The person's role in a workspace, from the workspace list — read once per
 * request, so a page asking spends nothing the layout did not. `undefined` when
 * the workspace is not on the list.
 */
export async function roleInWorkspace(
  workspaceId: string | undefined,
): Promise<WorkspaceRole | undefined> {
  if (!workspaceId) return undefined;
  return (await listWorkspaces()).find((entry) => entry.id === workspaceId)
    ?.role;
}

/**
 * Owner or admin — who the platform lets connect or disconnect an account,
 * export a workspace, or see and change its billing. The server enforces it on
 * every call; a page asks only so it does not offer what would be refused
 * (register F8).
 */
export function administers(role: WorkspaceRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

/**
 * The workspace a server action acts on: the session's active one, never one the
 * browser names — one helper for every action module (register F28). Called
 * inside the action's `try`, so a refused session read is shown in place rather
 * than throwing away what the person typed (backend §12.1 #160).
 */
export async function requireActiveWorkspaceId(): Promise<string> {
  const workspaceId = await resolveActiveWorkspaceId(await getAppSession());
  if (!workspaceId) throw new PlatformServerError("No active workspace", 401);
  return workspaceId;
}

/**
 * The active workspace changed in another tab after the page rendered, so an
 * action taken on that page would act on a workspace the person was not looking
 * at.
 */
export const WORKSPACE_CHANGED =
  "The active workspace changed in another tab. Reload this page before continuing.";

/**
 * The active workspace, only while it is still the one the page showed — or
 * `null`. The page sends the id it rendered; it is only compared, and the
 * action's path always uses the workspace the server resolves, never one the
 * browser names.
 */
export async function activeWorkspaceIfShown(
  shownWorkspaceId: string,
): Promise<string | null> {
  const workspaceId = await requireActiveWorkspaceId();
  return workspaceId === shownWorkspaceId ? workspaceId : null;
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<
      Schema["WorkspaceMemberListResponse"]
    >(withCursor(`${workspacePath(workspaceId)}/members`, cursor));
    return { items: response.members, nextCursor: response.nextCursor };
  });
}

export async function listWorkspaceProjects(
  workspaceId: string,
): Promise<Project[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<Schema["ProjectListResponse"]>(
      withCursor(`${workspacePath(workspaceId)}/projects`, cursor),
    );
    return { items: response.projects, nextCursor: response.nextCursor };
  });
}

export async function listAccessibleProjects(): Promise<
  Array<{ workspace: Workspace; project: Project }>
> {
  const workspaces = await listWorkspaces();
  const pages = await Promise.all(
    workspaces.map(async (workspace) => ({
      workspace,
      projects: await listWorkspaceProjects(workspace.id),
    })),
  );
  return pages.flatMap(({ workspace, projects }) =>
    projects.map((project) => ({ workspace, project })),
  );
}

export async function findAccessibleProject(projectId: string): Promise<{
  workspace: Workspace;
  project: Project;
} | null> {
  const projects = await listAccessibleProjects();
  return projects.find(({ project }) => project.id === projectId) ?? null;
}

export async function listProjectMemberships(
  workspaceId: string,
  projectId: string,
): Promise<ProjectMembership[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<
      Schema["ProjectMembershipListResponse"]
    >(withCursor(`${projectPath(workspaceId, projectId)}/memberships`, cursor));
    return { items: response.memberships, nextCursor: response.nextCursor };
  });
}

export async function listOrganizationDomains(
  workspaceId: string,
): Promise<OrganizationDomain[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<
      Schema["OrganizationDomainListResponse"]
    >(withCursor(`${workspacePath(workspaceId)}/domains`, cursor));
    return { items: response.domains, nextCursor: response.nextCursor };
  });
}

export async function listJoinRequests(
  workspaceId: string,
): Promise<OrganizationJoinRequest[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<
      Schema["OrganizationJoinRequestListResponse"]
    >(withCursor(`${workspacePath(workspaceId)}/join-requests`, cursor));
    return { items: response.requests, nextCursor: response.nextCursor };
  });
}

export async function createWorkspace(
  input: Schema["CreateWorkspaceRequest"],
): Promise<Schema["WorkspaceMutationResponse"]> {
  return platformServerJson<Schema["WorkspaceMutationResponse"]>(
    "/v1/workspaces",
    {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: newIdempotencyKey("workspace-create"),
    },
  );
}

export async function selectActiveWorkspace(
  workspaceId: string,
): Promise<Schema["ActiveWorkspaceResponse"]> {
  return platformServerJson<Schema["ActiveWorkspaceResponse"]>(
    "/v1/session/active-workspace",
    {
      method: "PATCH",
      body: JSON.stringify({ workspaceId }),
      idempotencyKey: newIdempotencyKey("workspace-activate"),
    },
  );
}

export async function updateWorkspace(
  workspaceId: string,
  input: Schema["UpdateWorkspaceRequest"],
): Promise<Schema["WorkspaceUpdateResponse"]> {
  return platformServerJson<Schema["WorkspaceUpdateResponse"]>(
    workspacePath(workspaceId),
    {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: newIdempotencyKey("workspace-update"),
    },
  );
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<Schema["RemovalResponse"]> {
  return platformServerJson<Schema["RemovalResponse"]>(
    `${workspacePath(workspaceId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE", idempotencyKey: newIdempotencyKey("workspace-member") },
  );
}

export async function createProject(
  workspaceId: string,
  input: Schema["CreateProjectRequest"],
): Promise<Project> {
  const response = await platformServerJson<Schema["ProjectMutationResponse"]>(
    `${workspacePath(workspaceId)}/projects`,
    {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: newIdempotencyKey("project-create"),
    },
  );
  return response.project;
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: Schema["UpdateProjectRequest"],
): Promise<Project> {
  const response = await platformServerJson<Schema["ProjectMutationResponse"]>(
    projectPath(workspaceId, projectId),
    {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: newIdempotencyKey("project-update"),
    },
  );
  return response.project;
}

export async function upsertProjectMembership(
  workspaceId: string,
  projectId: string,
  input: Schema["UpsertProjectMembershipRequest"],
): Promise<ProjectMembership> {
  const response = await platformServerJson<
    Schema["ProjectMembershipMutationResponse"]
  >(`${projectPath(workspaceId, projectId)}/memberships`, {
    method: "POST",
    body: JSON.stringify(input),
    idempotencyKey: newIdempotencyKey("project-member"),
  });
  return response.membership;
}

export async function removeProjectMembership(
  workspaceId: string,
  projectId: string,
  userId: string,
): Promise<Schema["RemovalResponse"]> {
  return platformServerJson<Schema["RemovalResponse"]>(
    `${projectPath(workspaceId, projectId)}/memberships/${encodeURIComponent(userId)}`,
    { method: "DELETE", idempotencyKey: newIdempotencyKey("project-member") },
  );
}

export async function discoverOrganizations(): Promise<
  DiscoverableOrganization[]
> {
  const response = await platformServerJson<
    Schema["OrganizationDiscoveryResponse"]
  >("/v1/organization-discovery");
  return response.organizations;
}

export async function requestOrganizationJoin(
  workspaceId: string,
): Promise<Schema["OrganizationJoinResponse"]> {
  return platformServerJson<Schema["OrganizationJoinResponse"]>(
    `/v1/organizations/${encodeURIComponent(workspaceId)}/join`,
    { method: "POST", idempotencyKey: newIdempotencyKey("organization-join") },
  );
}

export async function claimOrganizationDomain(
  workspaceId: string,
  input: Schema["ClaimOrganizationDomainRequest"],
): Promise<Schema["OrganizationDomainClaimResponse"]> {
  return platformServerJson<Schema["OrganizationDomainClaimResponse"]>(
    `${workspacePath(workspaceId)}/domains`,
    {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: newIdempotencyKey("domain-claim"),
    },
  );
}

export async function updateOrganizationDomain(
  workspaceId: string,
  domainId: string,
  input: Schema["UpdateOrganizationDomainRequest"],
): Promise<Schema["OrganizationDomainMutationResponse"]> {
  return platformServerJson<Schema["OrganizationDomainMutationResponse"]>(
    `${workspacePath(workspaceId)}/domains/${encodeURIComponent(domainId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: newIdempotencyKey("domain-update"),
    },
  );
}

export async function revokeOrganizationDomain(
  workspaceId: string,
  domainId: string,
): Promise<Schema["OrganizationDomainMutationResponse"]> {
  return platformServerJson<Schema["OrganizationDomainMutationResponse"]>(
    `${workspacePath(workspaceId)}/domains/${encodeURIComponent(domainId)}`,
    {
      method: "DELETE",
      idempotencyKey: newIdempotencyKey("domain-revoke"),
    },
  );
}

export async function verifyOrganizationDomain(
  workspaceId: string,
  domainId: string,
): Promise<Schema["OrganizationDomainMutationResponse"]> {
  return platformServerJson<Schema["OrganizationDomainMutationResponse"]>(
    `${workspacePath(workspaceId)}/domains/${encodeURIComponent(domainId)}/verification`,
    {
      method: "POST",
      idempotencyKey: newIdempotencyKey("domain-verify"),
    },
  );
}

export async function decideOrganizationJoinRequest(
  workspaceId: string,
  joinRequestId: string,
  decision: OrganizationJoinRequestDecision,
): Promise<Schema["OrganizationJoinRequestMutationResponse"]> {
  return platformServerJson<Schema["OrganizationJoinRequestMutationResponse"]>(
    `${workspacePath(workspaceId)}/join-requests/${encodeURIComponent(joinRequestId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision }),
      idempotencyKey: newIdempotencyKey("join-request-decision"),
    },
  );
}

export async function cancelOrganizationJoinRequest(
  workspaceId: string,
  joinRequestId: string,
): Promise<Schema["OrganizationJoinRequestMutationResponse"]> {
  return platformServerJson<Schema["OrganizationJoinRequestMutationResponse"]>(
    `${workspacePath(workspaceId)}/join-requests/${encodeURIComponent(joinRequestId)}`,
    {
      method: "DELETE",
      idempotencyKey: newIdempotencyKey("join-request-cancel"),
    },
  );
}

/* --- Teams: asking to join one (backend 24.11.2, 24.11.4) --------------------
 * A team is a project in the platform's contract. The directory lists every
 * open team in an organization by name and kind, and where this person stands
 * with each; a person asks onto one, withdraws their own request, and a team's
 * owner or admin — or the organization's — approves or denies. The platform
 * decides who may do what; these only ask. */

export async function listTeamDirectory(
  workspaceId: string,
): Promise<TeamDirectoryEntry[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<
      Schema["ProjectDirectoryResponse"]
    >(withCursor(`${workspacePath(workspaceId)}/project-directory`, cursor));
    return { items: response.projects, nextCursor: response.nextCursor };
  });
}

export async function listAccessRequests(
  workspaceId: string,
  projectId: string,
): Promise<AccessRequest[]> {
  return collectPages(async (cursor) => {
    const response = await platformServerJson<
      Schema["ProjectAccessRequestListResponse"]
    >(
      withCursor(
        `${projectPath(workspaceId, projectId)}/access-requests`,
        cursor,
      ),
    );
    return { items: response.requests, nextCursor: response.nextCursor };
  });
}

export async function requestProjectAccess(
  workspaceId: string,
  projectId: string,
): Promise<AccessRequest> {
  const response = await platformServerJson<
    Schema["ProjectAccessRequestMutationResponse"]
  >(`${projectPath(workspaceId, projectId)}/access-requests`, {
    method: "POST",
    idempotencyKey: newIdempotencyKey("project-access-request"),
  });
  return response.request;
}

export async function decideProjectAccess(
  workspaceId: string,
  projectId: string,
  requestId: string,
  decision: Schema["DecideProjectAccessRequest"]["decision"],
): Promise<AccessRequest> {
  const response = await platformServerJson<
    Schema["ProjectAccessRequestMutationResponse"]
  >(
    `${projectPath(workspaceId, projectId)}/access-requests/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision }),
      idempotencyKey: newIdempotencyKey("project-access-decision"),
    },
  );
  return response.request;
}

export async function cancelProjectAccess(
  workspaceId: string,
  projectId: string,
  requestId: string,
): Promise<AccessRequest> {
  const response = await platformServerJson<
    Schema["ProjectAccessRequestMutationResponse"]
  >(
    `${projectPath(workspaceId, projectId)}/access-requests/${encodeURIComponent(requestId)}`,
    {
      method: "DELETE",
      idempotencyKey: newIdempotencyKey("project-access-cancel"),
    },
  );
  return response.request;
}
