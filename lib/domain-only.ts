/**
 * An organization's domain-only setting — the owner's build 13 decision 8B: its
 * name, what it does, and its refusals, in the app's words
 * (`snoopy-mobile/lib/content/refusals.ts`), so a refusal reads the same in a
 * browser as on a phone.
 */
export const DOMAIN_ONLY_TITLE = "Verified domains only";
export const DOMAIN_ONLY_SUB =
  "Only people who sign in with addresses at your verified domains can join, and members can't link an account outside them.";

/** Asking to join an organization that admits only its verified domains. */
export const JOIN_OUTSIDE_DOMAIN =
  "This organization admits only people who sign in with addresses at its verified domains.";

/** Approving someone who signs in from outside them while the setting is on. */
export const APPROVAL_OUTSIDE_DOMAIN =
  "This person signs in with an address outside your verified domains, so they can't join while Verified domains only is on.";

/**
 * A refused change to the setting, by the reason the platform names (a 409).
 * Turning it on needs a verified domain and every member's sign-ins inside one;
 * nobody is removed, and a member the platform has not seen since the setting
 * arrived counts as outside until they sign in again. `null` for any other
 * refusal, which the caller words.
 */
export function domainOnlyRefusal(
  status: number,
  details: Record<string, unknown> | undefined,
): string | null {
  if (status !== 409) return null;
  if (details?.reason === "no_verified_domain") {
    return "Verify a domain before limiting the organization to it.";
  }
  if (details?.reason === "members_outside_domain") {
    const count = details.count;
    const counted = Number.isSafeInteger(count) && (count as number) > 0;
    const who = !counted
      ? "Some members sign"
      : count === 1
        ? "1 member signs"
        : `${count} members sign`;
    return `${who} in with an address outside your verified domains, so this can't be turned on yet. Nobody is removed. A member who hasn't signed in since this setting arrived counts until they sign in again.`;
  }
  return null;
}
