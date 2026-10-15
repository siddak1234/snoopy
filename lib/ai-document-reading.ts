import { platformServerJson } from "@/lib/platform-server";
import type { components } from "@/lib/generated/platform-contracts/platform";

export type AiDocumentReadingChoice =
  components["schemas"]["AiDocumentReadingChoice"]["choice"];
export type AiDocumentReadingState =
  components["schemas"]["AiDocumentReadingState"];

/**
 * Saves the account's answer to "AI reads your documents" (backend ADR-0038):
 * for the session's own person, in every workspace. Idempotent by value, so no
 * idempotency key — the same answer again changes nothing.
 */
export function setAiDocumentReading(
  choice: AiDocumentReadingChoice,
): Promise<AiDocumentReadingState> {
  const body: components["schemas"]["AiDocumentReadingChoice"] = { choice };
  return platformServerJson<AiDocumentReadingState>(
    "/v1/session/ai-document-reading",
    { method: "PUT", body: JSON.stringify(body) },
  );
}
