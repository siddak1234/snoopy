import type { NextRequest } from "next/server";
import { readItemFile, readItem } from "@/lib/automations";
import { fileViewResponse } from "@/lib/file-view";
import { PlatformServerError } from "@/lib/platform-server";

/**
 * The file an item was made from, shown in place on its file page or read
 * for the share sheet (Round 19, build 28; the owner's item 4): the
 * platform's signed link read on the server (`fileViewResponse`). An item of
 * another workspace, or of another flow than the path's, is the same "not
 * found".
 */

export const dynamic = "force-dynamic";
/** The file read whole (up to its bound) on a slow link: stated, not left to the host's default. */
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  context: RouteContext<"/account/flows/[subscriptionId]/items/[itemId]/file/view">,
) {
  const { subscriptionId, itemId } = await context.params;
  return fileViewResponse(request, async (workspaceId) => {
    const { item } = await readItem(workspaceId, itemId);
    if (item.subscriptionId !== subscriptionId)
      throw new PlatformServerError("Not Found", 404);
    return readItemFile(workspaceId, itemId);
  });
}
