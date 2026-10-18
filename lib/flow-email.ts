/**
 * Who a flow's run emails go to, as the website draws it (Build 22, P1 and P5;
 * spec §4; backend ADR-0041): the flow page's step 5 and its email page. The
 * workspace's owners and admins and the person who starts each run always get
 * it — the session's D1, approved by the owner (21:12Z) — and an owner or
 * admin may add more addresses on the flow's email page. The same rules and
 * words as the app's (snoopy-mobile `lib/view/flow-email.ts`,
 * `lib/content/screen-states.ts`).
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** The email page's words (spec §4), the app's byte for byte; headings in sentence case on the website. */
export const EMAIL_TITLE = "Who gets the email";
export const EMAIL_ALWAYS_LABEL = "Always";
export const EMAIL_ALSO_LABEL = "Also send to";
export const EMAIL_STARTER = "The person who starts the run";
export const EMAIL_ROLE: Readonly<Record<"owner" | "admin", string>> = {
  owner: "Owner",
  admin: "Admin",
};
/** No extra address. */
export const EMAIL_NONE = "None";
export const EMAIL_PLACEHOLDER = "Email address";
export const EMAIL_ADD = "Add";
export const EMAIL_ADDING = "Adding…";
export const EMAIL_REMOVING = "Removing…";
export function removeAddress(address: string): string {
  return `Remove ${address}`;
}
/** How many extra addresses a flow holds at most (backend ADR-0041; the session's S13). */
export const EMAIL_EXTRA_LIMIT = 10;
export const EMAIL_LIMIT_REACHED = "You can add up to 10.";
export const EMAIL_ASK_ADMIN = "Ask an owner or admin to change this.";
export const EMAIL_INVALID = "Enter an email address.";
export const EMAIL_DUPLICATE = "Already on the list.";
export const EMAIL_SAVE_FAILED = "Could not save. Try again.";
/** Step 5's address when its read failed (the session's S22). */
export const EMAIL_UNAVAILABLE = "Unavailable";
export function andMore(count: number): string {
  return `and ${count} more`;
}

/**
 * One email address, as the platform checks it (`FlowEmailAddress` in the
 * contract's `automations.yaml`, whose `pattern` the generated types do not
 * carry): one `@`, before it at most 64 characters with no space or
 * `<>,;"()[]\`, after it a domain with a dot. 3–254 characters.
 */
export const FLOW_EMAIL_PATTERN =
  /^[^\s@<>,;"()[\]\\]{1,64}@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/u;

/** Whether `address`, trimmed, is one the platform takes. */
export function isFlowEmail(address: string): boolean {
  const trimmed = address.trim();
  return (
    trimmed.length >= 3 &&
    trimmed.length <= 254 &&
    FLOW_EMAIL_PATTERN.test(trimmed)
  );
}

type Listed = {
  people: readonly { email: string }[];
  extra: readonly string[];
};

/** Every address listed, in order: the owners, then the admins (the platform's order), then the extra ones. */
export function listedAddresses(recipients: Listed): string[] {
  return [
    ...recipients.people.map((person) => person.email),
    ...recipients.extra,
  ];
}

/**
 * What an Add would be refused with, before anything is sent (the session's
 * S30): not an address, or one already listed — compared without case, as the
 * platform compares them.
 */
export function addProblem(
  address: string,
  recipients: Listed,
): "invalid" | "duplicate" | null {
  if (!isFlowEmail(address)) return "invalid";
  const wanted = address.trim().toLowerCase();
  return listedAddresses(recipients).some(
    (listed) => listed.toLowerCase() === wanted,
  )
    ? "duplicate"
    : null;
}

/**
 * The flow page's step 5 row (the session's S22): the first address listed and
 * "and {n} more" for the rest. With nobody listed — a workspace whose members
 * this person may not read, and no extra address — the one who always gets it:
 * the person who starts the run (the app's M2).
 */
export function recipientsLine(recipients: Listed): {
  first: string;
  more: string | null;
} {
  const listed = listedAddresses(recipients);
  if (listed.length === 0) return { first: EMAIL_STARTER, more: null };
  return {
    first: listed[0]!,
    more: listed.length > 1 ? andMore(listed.length - 1) : null,
  };
}

/** A flow's email page. */
export function emailPath(subscriptionId: string): string {
  return `/account/flows/${encodeURIComponent(subscriptionId)}/email`;
}
