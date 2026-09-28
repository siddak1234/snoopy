"use server";

import { PlatformServerError } from "@/lib/platform-server";
import {
  completeUpload,
  openUpload,
  type UploadedFile,
  type UploadTicket,
} from "@/lib/automations";
import { requireActiveWorkspaceId } from "@/lib/tenancy";

/**
 * A file for a run (FR-14). The bytes never pass through here: `open` answers
 * a signed URL the browser PUTs the file to directly, and `complete` asks the
 * platform what arrived. Only the file's id reaches the run's input.
 */

export type OpenUploadResult =
  { ok: true; ticket: UploadTicket } | { ok: false; error: string };
export type CompleteUploadResult =
  { ok: true; file: UploadedFile } | { ok: false; error: string };

const UPLOAD_REFUSALS: Record<string, string> = {
  content_type_not_accepted:
    "This automation does not accept that type of file.",
  file_too_large: "The file is larger than this automation accepts.",
  subscription_not_live: "Go live first; a paused automation takes no files.",
  no_file_input: "This automation does not take a file.",
  session_expired: "The upload took too long. Choose the file again.",
  no_object: "The file did not arrive. Choose it again.",
  too_large: "The file is larger than this automation accepts.",
};

function refused(error: unknown): { ok: false; error: string } {
  if (!(error instanceof PlatformServerError)) throw error;
  const reason = error.details?.reason;
  const known =
    typeof reason === "string" ? UPLOAD_REFUSALS[reason] : undefined;
  return { ok: false, error: known ?? error.message };
}

export async function openRunUpload(input: {
  subscriptionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<OpenUploadResult> {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) {
    return { ok: false, error: "The file is empty." };
  }
  try {
    const workspaceId = await requireActiveWorkspaceId();
    return {
      ok: true,
      ticket: await openUpload(workspaceId, {
        subscriptionId: input.subscriptionId,
        filename: input.filename,
        // A browser leaves the type empty for a file it cannot name; the
        // platform needs one, and a generic one is the honest answer.
        contentType: input.contentType || "application/octet-stream",
        sizeBytes: input.sizeBytes,
      }),
    };
  } catch (error) {
    return refused(error);
  }
}

export async function completeRunUpload(
  uploadSessionId: string,
): Promise<CompleteUploadResult> {
  try {
    const workspaceId = await requireActiveWorkspaceId();
    return {
      ok: true,
      file: await completeUpload(workspaceId, uploadSessionId),
    };
  } catch (error) {
    return refused(error);
  }
}
