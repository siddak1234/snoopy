"use server";

import { getAppSession } from "@/lib/app-session";
import { exportWorkspace, type WorkspaceExportResponse } from "@/lib/exports";
import { PlatformServerError } from "@/lib/platform-server";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

export type WorkspaceExportActionResult =
  | { ok: true; response: WorkspaceExportResponse }
  | { ok: false; error: string };

export async function requestWorkspaceExport(): Promise<WorkspaceExportActionResult> {
  try {
    // Inside the try: a refused session read is the platform's answer to show
    // (backend §12.1 #160).
    const session = await getAppSession();
    const workspaceId = await resolveActiveWorkspaceId(session);
    if (!workspaceId)
      return { ok: false, error: "No active workspace is available." };
    return { ok: true, response: await exportWorkspace(workspaceId) };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
