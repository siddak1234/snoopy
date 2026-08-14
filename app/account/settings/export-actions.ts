"use server";

import { getAppSession } from "@/lib/app-session";
import { exportWorkspace, type WorkspaceExportResponse } from "@/lib/exports";
import { PlatformServerError } from "@/lib/platform-server";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

export type WorkspaceExportActionResult =
  | { ok: true; response: WorkspaceExportResponse }
  | { ok: false; error: string };

export async function requestWorkspaceExport(): Promise<WorkspaceExportActionResult> {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId)
    return { ok: false, error: "No active workspace is available." };

  try {
    return { ok: true, response: await exportWorkspace(workspaceId) };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
