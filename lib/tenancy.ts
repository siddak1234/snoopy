import { newIdempotencyKey, platformServerJson } from "@/lib/platform-server";
import type { components } from "@/lib/generated/platform-contracts/platform";

type Schema = components["schemas"];

export type Workspace = Schema["WorkspaceSummary"];
export type WorkspaceMember = Schema["WorkspaceMember"];
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

function workspacePath(workspaceId: string): string {
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

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

async function listWorkspaceCollection(): Promise<
  Schema["WorkspaceListResponse"]
> {
  return platformServerJson<Schema["WorkspaceListResponse"]>("/v1/workspaces");
}

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

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<Project> {
  const response = await platformServerJson<Schema["ProjectMutationResponse"]>(
    projectPath(workspaceId, projectId),
  );
  return response.project;
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
