"use server";

import { revalidatePath } from "next/cache";
import { setAiDocumentReading } from "@/lib/ai-document-reading";
import { PlatformServerError } from "@/lib/platform-server";

/**
 * The account's answer to "AI reads your documents" (backend ADR-0038): the
 * consent card's Allow and Not now, the Settings switch, and Start run's Turn
 * on. The person's own account — the actor comes from the session, never from
 * the form — so no workspace is checked: the answer is the same in every one.
 *
 * Every account page reads it from the session, so the whole account area is
 * read again once it is saved. A refusal is said by the caller in its own
 * words (`AI_CONSENT.saveFailed`, `AI_SETTING.saveFailed`); the platform's
 * own message is not shown.
 */
export async function saveAiDocumentReading(
  choice: string,
): Promise<{ ok: boolean }> {
  if (choice !== "allowed" && choice !== "declined") return { ok: false };
  try {
    await setAiDocumentReading(choice);
  } catch (error) {
    if (error instanceof PlatformServerError) return { ok: false };
    throw error;
  }
  revalidatePath("/account", "layout");
  return { ok: true };
}
