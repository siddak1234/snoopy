/**
 * The account's AI consent (backend ADR-0038, BUILD-PLAN 25.4.21; the spec's
 * §3.G–§3.H). Asked once, on the account, after sign-in — not before each run:
 * the owner's build-19 feedback #4, "Shouldnt this happen at the time of
 * signing up for the account". The answer is the platform's
 * (`PUT /v1/session/ai-document-reading`, read back as `GET /v1/session`'s
 * `user.aiDocumentReading`), for the person, in every workspace, on every
 * device — so this browser keeps nothing.
 *
 * Apple's App Review Guideline 5.1.2(i) asks a person's explicit permission
 * before their data goes to a third-party AI; the card is that permission,
 * and "Not now" stops only document reading. Not a server gate: the platform
 * does not refuse a run on it, so the account area asks before a run with a
 * file starts on a flow that `usesAi`.
 *
 * The words live here, once, and test/ai-consent.test.mjs pins them byte for
 * byte. No React and no `@/` import here: the unit test loads this file as it
 * is.
 */

export const AI_CONSENT = {
  title: "AI reads your documents",
  body: "Some flows send a document you add to AI models, through OpenRouter, to read it. They don't keep it.",
  /** The link line; its words `policyLink` link to `policyHref`. */
  policy: "See our Privacy Policy.",
  policyLink: "Privacy Policy",
  policyHref: "/privacy",
  allow: "Allow",
  notNow: "Not now",
  saveFailed: "Could not save your choice. Try again.",
} as const;

/** Settings' switch (§3.H). */
export const AI_SETTING = {
  heading: "AI",
  label: "AI reads documents",
  saveFailed: "Could not save. Try again.",
} as const;

/** Under Start run, when the account said Not now (§3.H). */
export const AI_READING_OFF = {
  line: "AI reading is off.",
  turnOn: "Turn on",
} as const;

const linkAt = AI_CONSENT.policy.indexOf(AI_CONSENT.policyLink);
/** The link line's words before its link, and after it. */
export const POLICY_BEFORE_LINK = AI_CONSENT.policy.slice(0, linkAt);
export const POLICY_AFTER_LINK = AI_CONSENT.policy.slice(
  linkAt + AI_CONSENT.policyLink.length,
);

/** The account's answer: null while never asked; undefined from a platform that does not ask. */
export type AiChoice = "allowed" | "declined" | null | undefined;

/** The card shows once, while the account has never answered. */
export function asksForConsent(choice: AiChoice): boolean {
  return choice === null;
}

/**
 * What Start run does with a run (§3.H): a run with a file on a flow that
 * reads it with AI starts only once the account allowed it — asked first
 * while never answered, and said to be off after Not now. A run with no file,
 * a flow with no AI, or a platform that does not ask, starts as it is.
 */
export function runGate({
  usesAi,
  carriesFile,
  choice,
}: {
  usesAi: boolean;
  carriesFile: boolean;
  choice: AiChoice;
}): "start" | "ask" | "off" {
  if (!usesAi || !carriesFile) return "start";
  if (choice === null) return "ask";
  if (choice === "declined") return "off";
  return "start";
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
