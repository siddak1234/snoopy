/**
 * A sign-in or a link that came back refused, by the callback's reason (the
 * owner's build 13 decision 10A, TestFlight #19): one sentence per token and
 * nothing raw, so a crafted reason cannot put words on the page. The words are
 * the app's (`snoopy-mobile/lib/platform/native-auth.ts`, `identity-link.ts`).
 * Own properties only, so a reason such as `constructor` finds nothing.
 */
const SIGN_IN_FAILURES: Record<string, string> = {
  access_denied: "Sign-in was declined.",
  provider_disabled: "That sign-in provider isn't available.",
  signup_disabled: "New sign-ups are closed.",
  account_disabled: "This account is disabled.",
  email_unverified:
    "That sign-in's email address isn't verified. Verify it with the provider, then try again.",
};

/**
 * A link refused. An account already linked is never merged: the platform
 * sends one token whether it is linked to another account or already to this
 * one, so the sentence covers both. A domain-only organization's refusal comes
 * here on the website (the platform undid the link).
 */
const LINK_FAILURES: Record<string, string> = {
  identity_already_linked:
    "That account is already linked, to this account or another. To link it here, unlink it from the other account first.",
  access_denied: "Linking was declined.",
  linking_disabled: "Account linking isn't enabled on this platform yet.",
  provider_disabled: "That sign-in provider isn't available.",
  signup_disabled: "That account can't be linked: new sign-ups are closed.",
  account_disabled: "That account is disabled.",
  email_unverified:
    "That account's email address isn't verified. Verify it with the provider, then try again.",
  outside_org_domain:
    "That account wasn't linked: its address is outside your organization's verified domains.",
};

export const SIGN_IN_DID_NOT_COMPLETE =
  "Sign-in did not complete. Please try your provider again.";
export const LINK_DID_NOT_COMPLETE =
  "The account could not be linked. Try again.";

function said(table: Record<string, string>, reason: string | null) {
  return reason !== null && Object.hasOwn(table, reason)
    ? table[reason]
    : undefined;
}

export function signInFailure(reason: string | null): string {
  return said(SIGN_IN_FAILURES, reason) ?? SIGN_IN_DID_NOT_COMPLETE;
}

export function linkFailure(reason: string | null): string {
  return said(LINK_FAILURES, reason) ?? LINK_DID_NOT_COMPLETE;
}

/**
 * Where a signed-in person goes from a refused callback. Signed in already, they
 * were linking — the platform sends a link's refusal to the login page, as a
 * sign-in's — so back to their linked accounts, with the reason. Only a
 * well-formed token travels; anything else is said as "could not be linked".
 */
export function linkFailureHref(reason: string | null): string {
  const token =
    reason !== null && /^[a-z_]{1,64}$/u.test(reason)
      ? reason
      : "exchange_failed";
  return `/account/settings?link_error=${encodeURIComponent(token)}`;
}
