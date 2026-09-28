"use server";

import {
  exportWorkspace,
  readWorkspaceExport,
  startWorkspaceExport,
  type WorkspaceExportJob,
  type WorkspaceExportResponse,
} from "@/lib/exports";
import { PlatformServerError } from "@/lib/platform-server";
import { requireActiveWorkspaceId } from "@/lib/tenancy";

export type WorkspaceExportActionResult =
  | { ok: true; response: WorkspaceExportResponse }
  | { ok: false; error: string };

export async function requestWorkspaceExport(): Promise<WorkspaceExportActionResult> {
  try {
    // Inside the try: a refused session read is the platform's answer to show
    // (backend §12.1 #160).
    return {
      ok: true,
      response: await exportWorkspace(await requireActiveWorkspaceId()),
    };
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
export async function startCompleteExport(): Promise<CompleteExportActionResult> {
  try {
    return {
      ok: true,
      job: await startWorkspaceExport(await requireActiveWorkspaceId()),
    };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function readCompleteExport(
  exportId: string,
): Promise<CompleteExportActionResult> {
  try {
    return {
      ok: true,
      job: await readWorkspaceExport(
        await requireActiveWorkspaceId(),
        exportId,
      ),
    };
  } catch (error) {
    if (error instanceof PlatformServerError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
