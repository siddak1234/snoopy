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

/**
 * A domain-only organization's workspace refuses, at session resolve, a
 * person who holds a sign-in outside its verified domains (backend §12.1
 * #221, option b′: 403 `outside_org_domain`, `OutsideOrgDomainDetails`),
 * until that sign-in is removed; nothing is removed for them. The screen says
 * `JOIN_OUTSIDE_DOMAIN`, then this, then "Remove {provider} sign-in" for each.
 */
export const OUTSIDE_SIGN_IN_NEXT = "Remove your other sign-in to continue.";

/** A sign-in the refusal names (`OutsideOrgDomainDetails.providers`). */
export type OutsideSignIn = "google" | "microsoft" | "apple";

const SIGN_IN_NAME: Readonly<Record<OutsideSignIn, string>> = {
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
};

export function removeSignIn(provider: OutsideSignIn): string {
  return `Remove ${SIGN_IN_NAME[provider]} sign-in`;
}

/**
 * The sign-ins to remove, when a refusal is the outside-domain one: a 403
 * whose `details.reason` is `outside_org_domain`, its `providers` each once,
 * those this build knows. `null` for any other refusal, or one naming none.
 */
export function outsideSignIns(
  status: number,
  details: Record<string, unknown> | undefined,
): OutsideSignIn[] | null {
  if (status !== 403 || details?.reason !== "outside_org_domain") return null;
  const named = Array.isArray(details.providers) ? details.providers : [];
  const known = [
    ...new Set(
      named.filter((provider): provider is OutsideSignIn =>
        Object.hasOwn(SIGN_IN_NAME, String(provider)),
      ),
    ),
  ];
  return known.length > 0 ? known : null;
}

/**
 * The sign-ins to remove, read where the account area's error screen asks
 * (`app/account/error.tsx`), and only there. The platform refuses an
 * outside sign-in only on a request billed to the domain-only workspace
 * (one whose path names it), never on the session or the workspace list the
 * account layout reads, so a page's own read meets it first and its server
 * render throws to that screen. With the session kept, ONE read that names
 * the active workspace (`read`, through the proxy): its 403
 * `outside_org_domain` is the sign-ins to remove; anything else, or no
 * active workspace (then nothing is read), `null`.
 */
export async function outsideOnError(
  session: { user?: { activeWorkspaceId?: string } },
  read: (path: string) => Promise<unknown>,
): Promise<OutsideSignIn[] | null> {
  const active = session.user?.activeWorkspaceId;
  if (!active) return null;
  try {
    await read(`/v1/workspaces/${encodeURIComponent(active)}/members`);
    return null;
  } catch (error) {
    const refusal = error as {
      status?: unknown;
      details?: Record<string, unknown>;
    } | null;
    return typeof refusal?.status === "number"
      ? outsideSignIns(refusal.status, refusal.details)
      : null;
  }
}

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
