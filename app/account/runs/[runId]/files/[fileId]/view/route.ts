import type { NextRequest } from "next/server";
import { readRunFile } from "@/lib/automations";
import { fileViewResponse } from "@/lib/file-view";

/**
 * One of a job's uploaded files, shown in place on its file page or read for
 * the share sheet (Round 19, build 28; the owner's item 7): the platform's
 * signed link read on the server (`fileViewResponse`). Another workspace's
 * run, or a file not this job's, is the same "not found".
 */

export const dynamic = "force-dynamic";
/** The file read whole (up to its bound) on a slow link: stated, not left to the host's default. */
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  context: RouteContext<"/account/runs/[runId]/files/[fileId]/view">,
) {
  const { runId, fileId } = await context.params;
  return fileViewResponse(request, (workspaceId) =>
    readRunFile(workspaceId, runId, fileId),
  );
}
