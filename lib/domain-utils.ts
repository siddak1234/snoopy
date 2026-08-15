// Email parsing is presentation-only. Organization discovery and domain
// authority are always resolved by the public backend contract.
export const PUBLIC_DOMAIN_BLOCKLIST: ReadonlyArray<string> = [
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "live.com",
  "msn.com",
  "me.com",
  "googlemail.com",
  "ymail.com",
  "yahoo.co.uk",
  "outlook.co.uk",
  "mail.com",
  "zoho.com",
  "gmx.com",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
];

export function extractDomain(email: string): string {
  if (typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex < 1) return "";
  const domain = trimmed.slice(atIndex + 1);
  if (
    !domain ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".")
  ) {
    return "";
  }
  return domain;
}

export function isPublicDomain(domain: string): boolean {
  return PUBLIC_DOMAIN_BLOCKLIST.includes(domain.trim().toLowerCase());
}
