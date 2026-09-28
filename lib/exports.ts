import {
  platformServerJson,
  workspacePath as scope,
} from "@/lib/platform-server";
import type { ExportWorkspaceResponse } from "./export-contract";

export type { WorkspaceExportResponse } from "./export-contract";

export function exportWorkspace(
  workspaceId: string,
): Promise<ExportWorkspaceResponse> {
  return platformServerJson<ExportWorkspaceResponse>(
    `${scope(workspaceId)}/export`,
  );
}
