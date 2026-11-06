/**
 * A list row's text that is a way to reach someone (the owner's builds 37
 * and 39, item 11: "For number when i click or email it should pop up the
 * call or save contact"): one email address, or one phone number — the
 * WHOLE text, trimmed, and nothing else — so a row drawn by any flow is
 * pressed the same way, and no flow's code is named (`test/no-flow-code`).
 * A sentence that holds an address is words, never a link. The website
 * draws an email as a `mailto:` link and a phone as a `tel:` link, each with
 * Copy (`ContactValue`).
 *
 * The rule — the app's `snoopy-mobile/lib/view/contact-value.ts` holds the
 * same one, with the same test table: the text trimmed, at most 254
 * characters. An EMAIL is a local part, "@" and a domain with a dot
 * (`mailto:` + the text). A PHONE is only "+", digits, spaces, ".", "-",
 * "(" and ")", with 10 to 15 digits, or 8 to 15 when it starts with "+";
 * and when it does not start with "+", its runs of digits after the first
 * have 3 or more digits each and its last run 4 or more ("214-983-2568",
 * never a date, a time or an address like "10.5.2025 14.30" or
 * "192.168.10.100") — `tel:` + "+" when it starts with one + its digits.
 * Anything else is words.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export type ContactValue = {
  kind: "email" | "phone";
  /** The text as drawn: trimmed. */
  value: string;
  /** Where a press goes: `mailto:` or `tel:`. */
  href: string;
};

/** Copy's word, and what it says once the value is on the clipboard. */
export const COPY = "Copy";
export const COPIED = "Copied";

const EMAIL =
  /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/u;
const PHONE = /^\+?[\d\s().-]+$/u;
const PHONE_DIGITS = { min: 10, minInternational: 8, max: 15 } as const;
/** A number without "+": its digit runs after the first 3+ each, its last 4+. */
function groupedAsPhone(value: string): boolean {
  const runs = value.match(/\d+/gu) ?? [];
  return (
    runs.slice(1).every((run) => run.length >= 3) &&
    (runs.at(-1)?.length ?? 0) >= 4
  );
}

/** The text as a way to reach someone, or null when it is anything else. */
export function contactValue(text: unknown): ContactValue | null {
  if (typeof text !== "string") return null;
  const value = text.trim();
  if (!value || value.length > 254) return null;
  if (EMAIL.test(value))
    return { kind: "email", value, href: `mailto:${value}` };
  if (PHONE.test(value)) {
    const digits = value.replace(/\D/gu, "");
    const min = value.startsWith("+")
      ? PHONE_DIGITS.minInternational
      : PHONE_DIGITS.min;
    if (digits.length < min || digits.length > PHONE_DIGITS.max) return null;
    if (!value.startsWith("+") && !groupedAsPhone(value)) return null;
    return {
      kind: "phone",
      value,
      href: `tel:${value.startsWith("+") ? "+" : ""}${digits}`,
    };
  }
  return null;
}

/** What Copy writes to: the browser's clipboard, or a test's. */
export type Clipboard = { writeText: (text: string) => Promise<void> };

/**
 * Copy: the value itself, as drawn, onto the clipboard; true once it is
 * there, false when the browser refused it (a permission, an origin it does
 * not trust) — the value is still on the page to select.
 */
export async function copyValue(
  contact: ContactValue,
  clipboard: Clipboard,
): Promise<boolean> {
  try {
    await clipboard.writeText(contact.value);
    return true;
  } catch {
    return false;
  }
}
