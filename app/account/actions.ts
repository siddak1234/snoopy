"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-session";
import { PlatformServerError } from "@/lib/platform-server";
import { selectActiveWorkspace } from "@/lib/tenancy";

export type SelectWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function selectActiveWorkspaceAction(
  workspaceId: string,
): Promise<SelectWorkspaceResult> {
  try {
    // Inside the try: a refused session read is the platform's answer to show,
    // not "signed out" (backend §12.1 #160).
    if (!(await getAppSession())) {
      return {
        ok: false,
        error: "You must be signed in to switch workspaces.",
      };
    }
    await selectActiveWorkspace(workspaceId);
    revalidatePath("/account", "layout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof PlatformServerError
          ? error.message
          : "The workspace could not be switched.",
    };
  }
}
