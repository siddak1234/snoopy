"use server";

import {
  exportWorkspace,
  readWorkspaceExport,
  startWorkspaceExport,
  type WorkspaceExportJob,
  type WorkspaceExportResponse,
} from "@/lib/exports";
import { PlatformServerError } from "@/lib/platform-server";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";

// An export is of the workspace the person was looking at, so the page sends
// that id (`activeWorkspaceIfShown`, register F28): after a switch in another
// tab it is refused, never another workspace's records handed to this one.

export type WorkspaceExportActionResult =
  | { ok: true; response: WorkspaceExportResponse }
  | { ok: false; error: string };

export async function requestWorkspaceExport(
  shownWorkspaceId: string,
): Promise<WorkspaceExportActionResult> {
  try {
    // Inside the try: a refused session read is the platform's answer to show
    // (backend §12.1 #160).
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    return { ok: true, response: await exportWorkspace(workspaceId) };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export type CompleteExportActionResult =
  { ok: true; job: WorkspaceExportJob } | { ok: false; error: string };

/** Everything, staged as one file (backend §12.1 #39). */
export async function startCompleteExport(
  shownWorkspaceId: string,
): Promise<CompleteExportActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    return { ok: true, job: await startWorkspaceExport(workspaceId) };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function readCompleteExport(
  shownWorkspaceId: string,
  exportId: string,
): Promise<CompleteExportActionResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    return { ok: true, job: await readWorkspaceExport(workspaceId, exportId) };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
