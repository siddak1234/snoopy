/**
 * Asking before a run's file goes to an AI model. Apple's App Review Guideline
 * 5.1.2(i) has the iPhone app ask a person's explicit permission before their
 * data goes to a third-party AI, and the website's Run window asks the same,
 * in the app's words (snoopy-mobile, round-17/deletion-and-consent). The words
 * live here, once, and test/ai-consent.test.mjs pins them byte for byte.
 *
 * The website cannot tell which automation reads a file with a model, so it
 * asks before starting any run whose input carries a file, and never before one
 * that carries none. A person who agrees is not asked again in this browser:
 * the agreement is kept in localStorage under a key that names the consent's
 * version and the person's id, so new words (a new version) or another person
 * signed in here is asked afresh. A read that fails, or storage that cannot be
 * reached at all, asks again — it is never taken for agreement. A write that
 * fails after Agree still starts that run, and the next one asks again.
 *
 * Only the Run window asks. Neither `startRun` (actions.ts) nor the platform
 * checks, and the platform keeps no record of the agreement, so a direct POST
 * of that action, or of the platform's own start (which this site forwards
 * under /api/platform), starts a run with a file unasked. Another site cannot
 * send either; the person can, and so can code already running on this site.
 * The app, too, asks on the phone alone. A check that holds needs that record
 * in snoopy-backend; test/ai-consent.test.mjs holds the Run window as the only
 * code here that starts a run.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

/** Raised when the words, or what they describe, change: everyone is asked again. */
export const AI_CONSENT_VERSION = 1;

export const AI_CONSENT = {
  title: "AI reads this file",
  body: "To read the file you give this run, Autom8x sends it to OpenRouter, which passes it to AI model providers in the United States, using only endpoints that OpenRouter lists as zero data retention.",
  /** The second line; its words `policyLink` link to `policyHref`. */
  policy:
    "Our Privacy Policy names the providers and explains what may be kept.",
  policyLink: "Privacy Policy",
  policyHref: "/privacy",
  agree: "Agree and start",
  cancel: "Cancel",
} as const;

const linkAt = AI_CONSENT.policy.indexOf(AI_CONSENT.policyLink);
/** The second line's words before its link, and after it. */
export const POLICY_BEFORE_LINK = AI_CONSENT.policy.slice(0, linkAt);
export const POLICY_AFTER_LINK = AI_CONSENT.policy.slice(
  linkAt + AI_CONSENT.policyLink.length,
);

/** What is kept once a person agrees. Any other value read back is not agreement. */
const AGREED = "agreed";

/** This person's agreement's key in this browser; null without an id, which is never kept. */
export function aiConsentKey(userId: string): string | null {
  return userId ? `autom8x.ai-consent.v${AI_CONSENT_VERSION}.${userId}` : null;
}

/**
 * Whether this person agreed in this browser. The storage is reached inside
 * the guard, because in a browser that refuses it even reading
 * `window.localStorage` throws. Any failure is "not agreed".
 */
export function hasAiConsent(
  storage: () => Pick<Storage, "getItem">,
  userId: string,
): boolean {
  const key = aiConsentKey(userId);
  if (!key) return false;
  try {
    return storage().getItem(key) === AGREED;
  } catch {
    return false;
  }
}

/** Keeps this person's agreement; false when it could not be kept. Never throws. */
export function recordAiConsent(
  storage: () => Pick<Storage, "setItem">,
  userId: string,
): boolean {
  const key = aiConsentKey(userId);
  if (!key) return false;
  try {
    storage().setItem(key, AGREED);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a run's form carries a file: a field whose control is `artifact`
 * (`input-control:<key>`, ManifestFields.tsx) with a file's id under
 * `input:<key>`, which RunFileField.tsx renders only once the file's upload is
 * complete. A file field left empty carries nothing.
 */
export function runCarriesFile(form: FormData): boolean {
  for (const [name, control] of form.entries()) {
    if (!name.startsWith("input-control:") || control !== "artifact") continue;
    const id = form.get(`input:${name.slice("input-control:".length)}`);
    if (typeof id === "string" && id.trim() !== "") return true;
  }
  return false;
}
