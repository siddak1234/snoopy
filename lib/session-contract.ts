export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    workspaceId?: string;
  };
  workspaces: Array<{
    id: string;
    name: string;
    type: "personal" | "organization";
    role: "owner" | "admin" | "member";
  }>;
};

type BackendSessionResponse = {
  authenticated: true;
  user: {
    userId: string;
    email: string;
    displayName?: string;
    activeWorkspaceId?: string;
  };
  workspaces: Array<{
    id: string;
    name: string;
    type: "personal" | "organization";
    role: "owner" | "admin" | "member";
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBackendSession(value: unknown): value is BackendSessionResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<BackendSessionResponse>;
  if (!hasOnlyKeys(candidate, ["authenticated", "user", "workspaces"])) {
    return false;
  }
  if (!candidate.user || typeof candidate.user !== "object") return false;
  const user = candidate.user as
    Partial<BackendSessionResponse["user"]> | undefined;
  if (
    !user ||
    !hasOnlyKeys(user, ["userId", "email", "displayName", "activeWorkspaceId"])
  ) {
    return false;
  }
  if (!Array.isArray(candidate.workspaces)) return false;
  const workspaceIds = new Set<string>();
  for (const value of candidate.workspaces) {
    if (!isWorkspace(value) || workspaceIds.has(value.id)) return false;
    workspaceIds.add(value.id);
  }
  return (
    candidate.authenticated === true &&
    typeof user?.userId === "string" &&
    UUID_PATTERN.test(user.userId) &&
    typeof user.email === "string" &&
    user.email.length > 0 &&
    user.email.length <= 320 &&
    (user.displayName === undefined ||
      (typeof user.displayName === "string" &&
        user.displayName.length >= 1 &&
        user.displayName.length <= 200)) &&
    (user.activeWorkspaceId === undefined ||
      (typeof user.activeWorkspaceId === "string" &&
        UUID_PATTERN.test(user.activeWorkspaceId) &&
        workspaceIds.has(user.activeWorkspaceId)))
  );
}

function isWorkspace(
  value: unknown,
): value is BackendSessionResponse["workspaces"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const workspace = value as Partial<
    BackendSessionResponse["workspaces"][number]
  >;
  if (!hasOnlyKeys(workspace, ["id", "name", "type", "role"])) return false;
  return (
    typeof workspace.id === "string" &&
    UUID_PATTERN.test(workspace.id) &&
    typeof workspace.name === "string" &&
    workspace.name.length >= 2 &&
    workspace.name.length <= 120 &&
    (workspace.type === "personal" || workspace.type === "organization") &&
    (workspace.role === "owner" ||
      workspace.role === "admin" ||
      workspace.role === "member")
  );
}

function hasOnlyKeys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/** Convert the wire contract to the UI's established session shape. */
export function toAppSession(value: unknown): AppSession | null {
  if (!isBackendSession(value)) return null;
  return {
    user: {
      id: value.user.userId,
      email: value.user.email,
      ...(value.user.displayName ? { name: value.user.displayName } : {}),
      ...(value.user.activeWorkspaceId
        ? { workspaceId: value.user.activeWorkspaceId }
        : {}),
    },
    workspaces: value.workspaces.map((workspace) => ({ ...workspace })),
  };
}
