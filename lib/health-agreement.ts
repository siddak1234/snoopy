/**
 * The health data agreement (a Business Associate Agreement; backend
 * ADR-0049, C3 — the owner's item 3 of 2026-11-03: "Can we automate baa
 * generation during addition of a healthcare flow and it stays in the user
 * or orgs docs"): its words, and how a refused turn-on or run is read. The
 * same words as the app's (Round 21, Stage 2's NEW WORDS; builds 37 and 39,
 * wave 2).
 *
 * A flow that carries health data (`AutomationCatalogEntry.healthData`) is
 * added as a draft; turning it on, starting a run and an item's upload (which
 * starts a run) are refused 403 `agreement_required`
 * (`AgreementRequiredDetails`) until the workspace's owner accepts the
 * current version (ADR-0049 amendment 2). Set up shows it as its numbered
 * "Contract and accept" section (`contractStep`; the owner's item 9 of builds
 * 37 and 39: "Where is the BAA contract to view prefilled and checkmark to
 * accept below it … 4. Contract and accept"), and its Turn on accepts, then
 * turns the flow on, in one press. Start run and an item's upload still open
 * the one dialog (`app/account/flows/HealthAgreementDialog.tsx`), and the run
 * or the item is sent again with its own key; anyone else is told to ask the
 * owner. The signed copies are the workspace's Documents. ~~Add refused until
 * the owner accepted, in the dialog~~ until wave 2.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export const AGREEMENT_TITLE = "Health data agreement";
export const SIGNER_NAME = "Full name";
export const SIGNER_TITLE = "Title";
export const ACCEPT_AND_START = "Accept and start run";
/**
 * The button while it accepts and sends the run again: the words Start run
 * already says while it waits, the app's too (the session's decision of
 * Round 21, Stage 2's review, finding 6).
 */
export const STARTING = "Starting…";
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
 * The dialog's press, and Set up's Turn on: accept, unless this opening (or
 * this Set up) already did, then send the run or the item again, or the
 * turn-on (`repeat`). Accepted once, a press
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

/** Set up's numbered section for a flow that carries health data (plan 5). */
export const CONTRACT_STEP = "Contract and accept";
/** No version published yet (`current` null): Turn on waits for it. */
export const AGREEMENT_FINALIZING = "The agreement is being finalized.";
/** The section's or a read's failure, said as every other unread section is. */
export const AGREEMENT_UNAVAILABLE = "Unavailable";

/** The workspace accepted the current version: "Accepted · Version {n} · {date}" (the date in words already). */
export function agreementAccepted(version: number, date: string): string {
  return `Accepted · Version ${version} · ${date}`;
}

/** Under it: who signed, "{signerName}, {signerTitle}". */
export function signerLine(name: string, title: string): string {
  return `${name}, ${title}`;
}

/**
 * What Set up's "Contract and accept" section is (plan 1), in this order of
 * precedence after `hidden` (a flow that carries no health data):
 * `unavailable` — a read failed; `finalizing` — no version is published
 * (`current` null, or, for the owner, the text read answered 503);
 * `accepted` — the workspace accepted the current version; `sign` — the
 * owner, with the text read; `ask-owner` — anyone else (a member is never
 * read: the platform answers a member 403).
 */
export type ContractState =
  "hidden" | "unavailable" | "finalizing" | "accepted" | "sign" | "ask-owner";

export function contractStep(input: {
  role: "owner" | "admin" | "member" | undefined;
  healthData: boolean;
  /** The workspace's agreement (`readWorkspaceHealthDataAgreement`), or null when not read. */
  read: {
    current: { version: number; sha256: string } | null;
    acceptance: unknown;
  } | null;
  /** The text the owner reads, `"unpublished"` when its read answered 503, or null when not read. */
  text:
    { version: number; text: string; sha256: string } | "unpublished" | null;
  /** A read that failed (anything but the text's 503). */
  readFailed: boolean;
}): ContractState {
  if (!input.healthData) return "hidden";
  if (input.readFailed) return "unavailable";
  if (input.read?.current === null || input.text === "unpublished")
    return "finalizing";
  if (input.read?.acceptance) return "accepted";
  if (input.role === "owner")
    return input.read && input.text ? "sign" : "unavailable";
  return "ask-owner";
}

/**
 * Whether Turn on may be pressed for this section (plan 3): a flow without
 * it, or accepted; for the owner signing, only once the box is ticked and
 * both fields are filled.
 */
export function contractAllowsTurnOn(
  state: ContractState,
  signed: { authorized: boolean; name: string; title: string },
): boolean {
  if (state === "hidden" || state === "accepted") return true;
  if (state !== "sign") return false;
  return (
    signed.authorized && signed.name.trim() !== "" && signed.title.trim() !== ""
  );
}

/**
 * The text as the owner reads it before signing (plan 2), for display only:
 * every `{Covered Entity}` the workspace's name, every `{Effective date}`
 * today's UTC date, `YYYY-MM-DD` — what the platform writes into the signed
 * copy at acceptance. The hash sent is the unfilled text's, as read.
 */
export function fillForDisplay(
  text: string,
  organization: string,
  today: string,
): string {
  return text
    .replaceAll("{Covered Entity}", organization)
    .replaceAll("{Effective date}", today.slice(0, 10));
}
