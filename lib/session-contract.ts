export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    workspaceId?: string;
  };
};

type BackendSessionResponse = {
  authenticated: true;
  user: {
    userId: string;
    email: string;
    displayName?: string;
    activeWorkspaceId?: string;
  };
};

function isBackendSession(value: unknown): value is BackendSessionResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BackendSessionResponse>;
  const user = candidate.user as
    Partial<BackendSessionResponse["user"]> | undefined;
  return (
    candidate.authenticated === true &&
    typeof user?.userId === "string" &&
    user.userId.length > 0 &&
    typeof user.email === "string" &&
    user.email.length > 0
  );
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
  };
}
