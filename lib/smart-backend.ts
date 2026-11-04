/**
 * Connect your EHR (backend ADR-0050, D1; the owner's item 1 of 2026-11-03:
 * "Our goal is to be agnostic"): a SMART Backend Services provider — `authType`
 * `smart-backend`, the EHR — is connected through Connections' key form, as
 * a pasted-key provider is: its fields from `credentialFields` (the clinic's
 * FHIR address), and its vendor, picked only when the platform lists two or
 * more `vendors` (it lists only those it holds a key for). Nothing secret is
 * pasted: the platform signs with its own key for that vendor. The address
 * the platform will not use is said in the spec's words, by its reason. The
 * same rules and words as the app's.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

type Vendor = { id: string; label: string };

/** A provider whose Connect opens the key form: a pasted key's, or the EHR's. */
export function opensKeyForm(authType: string | undefined | null): boolean {
  return authType === "api-key" || authType === "smart-backend";
}

/**
 * The key form's vendor: a picker of the listed vendors when there are two or
 * more; the one listed, sent unseen, when there is one; `null` for a provider
 * that is not the EHR's kind, or lists none.
 */
export function vendorField(provider: {
  authType: string;
  vendors?: readonly Vendor[];
}):
  | { kind: "picker"; vendors: readonly Vendor[] }
  | { kind: "fixed"; id: string }
  | null {
  if (provider.authType !== "smart-backend") return null;
  const vendors = provider.vendors ?? [];
  if (vendors.length >= 2) return { kind: "picker", vendors };
  return vendors.length === 1 ? { kind: "fixed", id: vendors[0].id } : null;
}

/** The connect refusals the platform names for a FHIR address (`connectProviderWithKey`'s 400), in words. */
export const SMART_BACKEND_REFUSALS: Record<string, string> = {
  fhir_address_refused: "Use the https address your EHR team gave you.",
  fhir_not_answering: "That address didn't answer as a FHIR server.",
  ehr_not_activated:
    "Your EHR hasn't turned on Autom8x yet. Ask your EHR team to activate it.",
};

/** A connect's 400 in words, when its reason is one of those; else `null`. */
export function smartBackendRefusal(
  status: number,
  details: Record<string, unknown> | undefined,
): string | null {
  const reason = details?.reason;
  return status === 400 &&
    typeof reason === "string" &&
    Object.hasOwn(SMART_BACKEND_REFUSALS, reason)
    ? SMART_BACKEND_REFUSALS[reason]
    : null;
}
