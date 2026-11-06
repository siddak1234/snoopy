/**
 * A list row's text that is a way to reach someone (the owner's builds 37
 * and 39, item 11: "For number when i click or email it should pop up the
 * call or save contact"): one email address, or one phone number — the
 * WHOLE text, trimmed, and nothing else — so a row drawn by any flow is
 * pressed the same way, and no flow's code is named (`test/no-flow-code`).
 * A sentence that holds an address is words, never a link. The website
 * draws an email as a `mailto:` link and a phone as a `tel:` link, each with
 * Copy (`ContactValue`); the app's `contact-value` reads the same.
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

/** One address: a local part and a domain with a dot, no space, no second "@". */
const EMAIL =
  /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/u;
/** A number as people write it: a leading "+", digits, spaces, dots, dashes and brackets. */
const PHONE = /^\+?[\d\s().-]+$/u;
/**
 * The fewest and most digits a phone number has: 10 (a national number with
 * its area code), or 8 written with its "+" country code; at most 15
 * (E.164). Fewer is a date or a span of years ("2019 - 2023"), never a phone.
 */
const PHONE_DIGITS = { min: 10, minInternational: 8, max: 15 } as const;

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
