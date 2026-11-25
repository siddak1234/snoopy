/**
 * Connect your EHR (backend ADR-0050, D1; the owner's item 1 of 2026-11-03:
 * "Our goal is to be agnostic"): a SMART provider. Two kinds, one form:
 *
 * - `smart-backend` (SMART Backend Services, ADR-0050) is connected through
 *   Connections' key form, as a pasted-key provider is, and the platform
 *   signs with its own key for that vendor.
 * - `smart-launch` (SMART App Launch, ADR-0054; the EHR since then) is
 *   connected by signing in: the same fields go to `authorize` as
 *   `credentials`, and the browser goes to the EHR's own sign-in page and
 *   comes back as an OAuth connect does. One sign-in serves every flow in the
 *   workspace.
 *
 * Either form's fields come from `credentialFields` (the clinic's FHIR
 * address), and its vendor is picked only when the platform lists two or
 * more `vendors` (it lists only those it holds a key for). Nothing secret is
 * typed. A refusal is said in the spec's words, by its reason — the
 * backend's `snoopy-backend/docs/openapi/connections.yaml`, where each is
 * defined once. The same rules and words as the app's.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

type Vendor = { id: string; label: string };

/** A provider whose Connect opens the key form: a pasted key's, or a SMART Backend Services EHR's. */
export function opensKeyForm(authType: string | undefined | null): boolean {
  return authType === "api-key" || authType === "smart-backend";
}

/** A provider whose Connect opens the sign-in form: an EHR a person signs in to (ADR-0054). */
export function opensSignInForm(authType: string | undefined | null): boolean {
  return authType === "smart-launch";
}

/**
 * The form's vendor, for either SMART kind: a picker of the listed vendors
 * when there are two or more; the one listed, sent unseen, when there is
 * one; `null` for a provider that is not a SMART kind, or lists none.
 */
export function vendorField(provider: {
  authType: string;
  vendors?: readonly Vendor[];
}):
  | { kind: "picker"; vendors: readonly Vendor[] }
  | { kind: "fixed"; id: string }
  | null {
  if (
    provider.authType !== "smart-backend" &&
    !opensSignInForm(provider.authType)
  )
    return null;
  const vendors = provider.vendors ?? [];
  if (vendors.length >= 2) return { kind: "picker", vendors };
  return vendors.length === 1 ? { kind: "fixed", id: vendors[0].id } : null;
}

/**
 * The form's values, as `KeyFields` posts them — each `credential:<name>`,
 * the vendor as `credential:vendor` — by name, each trimmed.
 */
export function postedCredentials(form: {
  entries(): Iterable<[string, unknown]>;
}): Record<string, string> {
  const credentials: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("credential:") || typeof value !== "string") continue;
    credentials[key.slice("credential:".length)] = value.trim();
  }
  return credentials;
}

/** The sign-in form's button before a vendor is picked. */
export const SIGN_IN = "Sign in";

/**
 * The sign-in form's button, named by the vendor chosen — "Sign in with
 * Epic" — from the platform's own label for it, so another EHR's is its
 * own; "Sign in" until one is picked (the session's wording, Round 22).
 */
export function signInLabel(
  vendors: readonly Vendor[] | undefined,
  vendorId: string | null | undefined,
): string {
  const vendor = vendors?.find((candidate) => candidate.id === vendorId);
  return vendor ? `${SIGN_IN} with ${vendor.label}` : SIGN_IN;
}

/**
 * The connect refusals the platform names for a FHIR address
 * (`connectProviderWithKey`'s 400), in the spec's words — all three, as
 * drawn here; the app adds them too (the session's decision of Round 21,
 * Stage 2's review, finding 6).
 */
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
  return said(SMART_BACKEND_REFUSALS, status === 400, details);
}

/**
 * A sign-in's begin refusals (`beginConnectionAuthorization`'s 400 for an
 * EHR sign-in, ADR-0054), in the spec's words: the two addresses the key
 * form's refusals name too, and an EHR without the sign-in.
 */
export const EHR_SIGN_IN_REFUSALS: Record<string, string> = {
  fhir_address_refused: SMART_BACKEND_REFUSALS.fhir_address_refused,
  fhir_not_answering: SMART_BACKEND_REFUSALS.fhir_not_answering,
  ehr_sign_in_unsupported:
    "That EHR doesn't offer the sign-in Autom8x uses. Ask your EHR team.",
};

/**
 * The begin's 409 `account_mismatch`: another address than the one the
 * workspace is signed in to. Nothing was started; its question is answered
 * by Replace, which begins again naming the live connection.
 */
export const EHR_ACCOUNT_MISMATCH =
  "This workspace is signed in to another EHR address. Replace it?";

/** The button that answers it (the session's wording, Round 22). */
export const EHR_REPLACE = "Replace";

/**
 * A sign-in's begin refused, in words: a 400 by its reason, or the 409
 * `account_mismatch`, which can be replaced; `null` for any other answer,
 * which keeps the platform's.
 */
export function ehrSignInRefusal(
  status: number,
  details: Record<string, unknown> | undefined,
): { message: string; replaceable: boolean } | null {
  if (status === 409 && details?.reason === "account_mismatch")
    return { message: EHR_ACCOUNT_MISMATCH, replaceable: true };
  const message = said(EHR_SIGN_IN_REFUSALS, status === 400, details);
  return message === null ? null : { message, replaceable: false };
}

/**
 * The reasons a sign-in comes back refused with (the callback's
 * `status=error&reason=`, ADR-0054), in the spec's words — the three a person
 * can act on.
 */
export const EHR_SIGN_IN_RETURNS: Record<string, string> = {
  no_refresh_token:
    "Your EHR team needs to allow a lasting sign-in for Autom8x. Ask them, then sign in again.",
  fhir_address_refused: SMART_BACKEND_REFUSALS.fhir_address_refused,
  fhir_not_answering: SMART_BACKEND_REFUSALS.fhir_not_answering,
};

/**
 * A refused return's words, by its reason; `null` for any other token, or
 * none — and own properties only, so a crafted reason finds nothing.
 */
export function ehrSignInReturn(reason: unknown): string | null {
  return typeof reason === "string" &&
    Object.hasOwn(EHR_SIGN_IN_RETURNS, reason)
    ? EHR_SIGN_IN_RETURNS[reason]
    : null;
}

function said(
  table: Record<string, string>,
  applies: boolean,
  details: Record<string, unknown> | undefined,
): string | null {
  const reason = details?.reason;
  return applies && typeof reason === "string" && Object.hasOwn(table, reason)
    ? table[reason]
    : null;
}
