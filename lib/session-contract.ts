import type { components } from "@/lib/generated/platform-contracts/platform";

type SessionResponse = components["schemas"]["SessionResponse"];

/** The account's AI consent, as `GET /v1/session` says it (ADR-0038). */
export type AiDocumentReading = SessionResponse["user"]["aiDocumentReading"];

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    workspaceId?: string;
    /**
     * The account's answer to "AI reads your documents" (backend ADR-0038):
     * null while never asked, when the account area shows the card once.
     * Absent only from a platform from before it asked (backend 25.4.21),
     * which neither shows the card nor holds a run for it.
     */
    aiDocumentReading?: AiDocumentReading;
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
      ...(value.user.aiDocumentReading === undefined
        ? {}
        : { aiDocumentReading: value.user.aiDocumentReading }),
    },
    workspaces: value.workspaces.map((workspace) => ({ ...workspace })),
    workspacesTruncated: value.workspacesTruncated === true,
  };
}
