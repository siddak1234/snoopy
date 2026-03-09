"use client";

/**
 * Build the OAuth callback URL for Supabase Auth.
 *
 * Always uses the current window origin so that the PKCE code verifier cookie
 * written by @supabase/ssr is scoped to the same origin the callback runs on.
 */
export function buildAuthCallbackUrl(nextPath: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

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

