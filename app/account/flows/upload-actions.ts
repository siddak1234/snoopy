"use server";

import { PlatformServerError } from "@/lib/platform-server";
import {
  completeUpload,
  discardUpload,
  openUpload,
  type UploadedFile,
  type UploadTicket,
} from "@/lib/automations";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";
import { waitsToBeMeasured } from "./upload-completion";
import { uploadRefusalMessage } from "./upload-refusals";

/**
 * A file for a run (FR-14). The bytes never pass through here: `open` answers
 * a signed URL the browser PUTs the file to directly, and `complete` asks the
 * platform what arrived. Only the file's id reaches the run's input.
 * `discard` deletes a file the field let go of before any run was given it
 * (the owner's decision 17 of 2026-11-15, "delete at once"; `discardUpload`).
 *
 * Each acts on the workspace the page showed (register F28, F70): after a
 * switch in another tab, the file is neither opened in nor completed against
 * another workspace, and the refusal is said in words; a discard then sends
 * nothing, and retention deletes the file as it did before.
 */

export type OpenUploadResult =
  { ok: true; ticket: UploadTicket } | { ok: false; error: string };
export type CompleteUploadResult =
  | { ok: true; file: UploadedFile }
  | {
      ok: false;
      error: string;
      /**
       * The file has no place yet to be measured (backend BUILD-PLAN 25.2.39):
       * nothing was refused, its upload is still open, and the browser
       * completes it again (`upload-completion.ts`). Set for a 429
       * `measurement_busy` and for nothing else.
       */
      measurementBusy?: true;
      /** That answer's `retry-after`, in seconds, when it named one. */
      retryAfterSeconds?: number;
    };

function refused(error: unknown): { ok: false; error: string } {
  if (!(error instanceof PlatformServerError)) throw error;
  const known = uploadRefusalMessage(error.details?.reason, error.details);
  return { ok: false, error: known ?? error.message };
}

export async function openRunUpload(input: {
  /** The workspace the page showed. */
  workspaceId: string;
  subscriptionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<OpenUploadResult> {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) {
    return { ok: false, error: "The file is empty." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(input.workspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
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
  shownWorkspaceId: string,
  uploadSessionId: string,
): Promise<CompleteUploadResult> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    return {
      ok: true,
      file: await completeUpload(workspaceId, uploadSessionId),
    };
  } catch (error) {
    const answer = refused(error);
    if (
      error instanceof PlatformServerError &&
      waitsToBeMeasured(error.status, error.details)
    ) {
      return {
        ...answer,
        measurementBusy: true,
        ...(error.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: error.retryAfterSeconds }),
      };
    }
    return answer;
  }
}

/**
 * A file the field let go of before any run was given it — its x, a choice
 * that replaced or emptied it, an upload that ended after the field stopped
 * waiting, the job upload card's Cancel — deleted at once, in the background
 * (`discardFiles` in `RunFileField.tsx`). It says nothing whatever the
 * platform answers (204; 400, 404, 409 `file_in_use`, 503) or if it cannot be
 * reached: the file is already out of the form, and retention deletes what a
 * discard could not.
 */
export async function discardRunUpload(
  shownWorkspaceId: string,
  artifactId: string,
): Promise<void> {
  try {
    const workspaceId = await activeWorkspaceIfShown(shownWorkspaceId);
    if (!workspaceId) return;
    await discardUpload({ workspaceId, artifactId });
  } catch {
    // Nothing is said: see above.
  }
}
