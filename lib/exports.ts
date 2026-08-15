import { platformServerJson } from "@/lib/platform-server";
import type { ExportWorkspaceResponse } from "./export-contract";

export type { WorkspaceExportResponse } from "./export-contract";

function scope(workspaceId: string): string {
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function exportWorkspace(
  workspaceId: string,
): Promise<ExportWorkspaceResponse> {
  return platformServerJson<ExportWorkspaceResponse>(
    `${scope(workspaceId)}/export`,
  );
}
