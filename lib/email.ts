/**
 * Gmail domains that should use Google OAuth instead of email/password.
 * When user enters one of these on login/signup, we redirect to Google sign-in.
 */
const GMAIL_DOMAINS = ["@gmail.com", "@googlemail.com"];

export function isGmailAddress(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return GMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
}
