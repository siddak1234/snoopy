/**
 * The health data agreement (a Business Associate Agreement; backend
 * ADR-0049, C3 — the owner's item 3 of 2026-11-03: "Can we automate baa
 * generation during addition of a healthcare flow and it stays in the user
 * or orgs docs"): its words, and how a refused add or run is read. The same
 * words as the app's (Round 21, Stage 2's NEW WORDS).
 *
 * A flow that carries health data is refused 403 `agreement_required`
 * (`AgreementRequiredDetails`) on Add, on Start run and on an item's upload
 * (which starts a run) until the workspace's owner accepts the current
 * version. The owner reads it in one dialog
 * (`app/account/flows/HealthAgreementDialog.tsx`) and accepts, and the add,
 * the run or the item is sent again with its own key; anyone else is told to
 * ask the owner. The signed copies are the workspace's Documents.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export const AGREEMENT_TITLE = "Health data agreement";
export const SIGNER_NAME = "Full name";
export const SIGNER_TITLE = "Title";
export const ACCEPT_AND_ADD = "Accept and add flow";
export const ACCEPT_AND_START = "Accept and start run";
/** Anyone but the workspace's owner, refused: the one line, and nothing more. */
export const ASK_OWNER =
  "Ask your workspace owner to accept the health data agreement.";
/** No version published yet (503 `agreement_not_published`, or no `version`). */
export const AGREEMENT_NOT_PUBLISHED =
  "The health data agreement isn't available yet.";

export const DOCUMENTS = "Documents";
export const NO_DOCUMENTS = "No documents yet.";

/** The line under the dialog's title. */
export function agreementVersion(version: number): string {
  return `Version ${version}`;
}

/** The checkbox: the signer says they may sign for the workspace. */
export function authorizedToSign(organization: string): string {
  return `I'm authorized to sign for ${organization}`;
}

/** The kinds a document can be, by the name a person reads. */
const DOCUMENT_NAMES: Record<string, string> = {
  "health-data": "Business Associate Agreement",
};

/**
 * A document's row and its page's title: "Business Associate Agreement ·
 * Version {n}"; `null` for a kind this build does not know (the platform
 * keeps the kind open), which the list leaves out.
 */
export function documentName(document: {
  kind: string;
  version: number;
}): string | null {
  const name = Object.hasOwn(DOCUMENT_NAMES, document.kind)
    ? DOCUMENT_NAMES[document.kind]
    : null;
  return name ? `${name} · Version ${document.version}` : null;
}

/** Under it: who accepted it, and the day (already in words). */
export function acceptedBy(name: string, date: string): string {
  return `Accepted by ${name} on ${date}`;
}

/**
 * A refusal that is the agreement's: 403 `agreement_required`, its kind and,
 * when one is published, its version. `null` for any other refusal.
 */
export function agreementRequired(
  status: number,
  details: Record<string, unknown> | undefined,
): { kind: string; version?: number } | null {
  if (status !== 403 || details?.reason !== "agreement_required") return null;
  const kind = typeof details.kind === "string" ? details.kind : "health-data";
  const version = details.version;
  return Number.isSafeInteger(version) && (version as number) >= 1
    ? { kind, version: version as number }
    : { kind };
}

/**
 * The dialog's press: accept, unless this opening already did, then send
 * the add, the run or the item again (`repeat`). Accepted once, a press
 * after the repeat was refused sends the repeat alone, never a second
 * acceptance. What it came to: whether it is accepted now, and the refusal
 * to say — the acceptance's, or the repeat's — or null once it went.
 */
export async function acceptThenRepeat(
  accepted: boolean,
  accept: () => Promise<{ ok: true } | { ok: false; error: string }>,
  repeat: () => Promise<string | null>,
): Promise<{ accepted: boolean; error: string | null }> {
  if (!accepted) {
    const acceptance = await accept();
    if (!acceptance.ok) return { accepted: false, error: acceptance.error };
  }
  return { accepted: true, error: await repeat() };
}

/** What the dialog shows and sends back: the text read, its version and hash, and who signs for. */
export type AgreementOffer = {
  version: number;
  text: string;
  sha256: string;
  /** The workspace's name, which the checkbox names. */
  organization: string;
};
