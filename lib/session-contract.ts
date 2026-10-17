import type { components } from "@/lib/generated/platform-contracts/platform";

type SessionResponse = components["schemas"]["SessionResponse"];

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
  workspacesTruncated: boolean;
};

/** Convert the wire contract to the UI's established session shape. */
export function toAppSession(value: SessionResponse): AppSession {
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
    workspacesTruncated: value.workspacesTruncated === true,
  };
}
