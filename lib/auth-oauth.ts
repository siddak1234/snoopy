"use client";

/**
 * Canonical app origin used for OAuth callbacks.
 * In production, prefer NEXT_PUBLIC_APP_URL so we never accidentally use a
 * preview / Vercel URL as the public-facing auth domain.
 */
function getCanonicalAppOrigin(): string {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envOrigin && process.env.NODE_ENV === "production") {
    return envOrigin;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return envOrigin ?? "";
}

/**
 * Build the OAuth callback URL for Supabase Auth.
 *
 * Uses the canonical app origin (NEXT_PUBLIC_APP_URL in production) so that the
 * PKCE code verifier cookie written by @supabase/ssr is scoped to the same
 * origin the callback runs on.
 */
export function buildAuthCallbackUrl(nextPath: string): string {
  const origin = getCanonicalAppOrigin();

  const normalizedNext =
    nextPath && nextPath.startsWith("/") ? nextPath : `/${nextPath || ""}`;

  const url = `${origin}/auth/callback?next=${encodeURIComponent(
    normalizedNext,
  )}`;

  if (process.env.NEXT_PUBLIC_AUTH_DEBUG === "1") {
    console.log("OAUTH_START", { origin, next: normalizedNext, redirectTo: url });
  }

  return url;
}

