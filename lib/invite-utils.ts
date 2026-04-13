/**
 * Browser-safe invite utilities.
 * No Node.js-only imports — safe to use in client components.
 */

/** Normalise a user-typed invite code: uppercase, strip spaces/hyphens. */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s\-]/g, "");
}

/**
 * Extract the invite token from a full URL or a bare token string.
 * Handles both "https://…/invite/<token>" and raw UUIDs.
 */
export function parseInviteToken(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
}
