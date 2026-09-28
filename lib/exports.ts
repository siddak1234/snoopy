import {
  newIdempotencyKey,
  platformServerJson,
  workspacePath as scope,
} from "@/lib/platform-server";
import type {
  ExportWorkspaceResponse,
  WorkspaceExportJob,
  WorkspaceExportJobResponse,
} from "./export-contract";

export type {
  WorkspaceExportJob,
  WorkspaceExportResponse,
} from "./export-contract";

export function exportWorkspace(
  workspaceId: string,
): Promise<ExportWorkspaceResponse> {
  return platformServerJson<ExportWorkspaceResponse>(
    `${scope(workspaceId)}/export`,
  );
}

/**
 * Asks for everything, staged as one file (backend §12.1 #39). Answers at
 * once; while one runs, asking again answers that one.
 */
export async function startWorkspaceExport(
  workspaceId: string,
): Promise<WorkspaceExportJob> {
  const response = await platformServerJson<WorkspaceExportJobResponse>(
    `${scope(workspaceId)}/exports`,
    { method: "POST", idempotencyKey: newIdempotencyKey("workspace-export") },
  );
  return response.export;
}

/** Its state, with a freshly signed link to the file once it is ready. */
export async function readWorkspaceExport(
  workspaceId: string,
  exportId: string,
): Promise<WorkspaceExportJob> {
  const response = await platformServerJson<WorkspaceExportJobResponse>(
    `${scope(workspaceId)}/exports/${encodeURIComponent(exportId)}`,
  );
  return response.export;
}
