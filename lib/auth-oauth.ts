"use client";

/**
 * Origin used when building the OAuth callback URL.
 *
 * In the browser we always use window.location.origin so the callback lands on
 * the same origin that set the PKCE verifier cookie. Using a different origin
 * (e.g. NEXT_PUBLIC_APP_URL) would cause the callback request to miss the cookie
 * and fail with "PKCE code verifier not found in storage".
 */
function getCanonicalAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return envOrigin ?? "";
}

/**
 * Build the OAuth callback URL for Supabase Auth.
 *
 * In the browser, origin is always window.location.origin so the callback
 * request is on the same host that set the PKCE verifier cookie.
 */
export function buildAuthCallbackUrl(nextPath: string): string {
  const origin = getCanonicalAppOrigin();

  const normalizedNext =
    nextPath && nextPath.startsWith("/") ? nextPath : `/${nextPath || ""}`;

  const url = `${origin}/auth/callback?next=${encodeURIComponent(
    normalizedNext,
  )}`;

  if (process.env.NEXT_PUBLIC_AUTH_DEBUG === "1") {
    console.log("OAUTH_START", {
      origin,
      next: normalizedNext,
      redirectTo: url,
    });
  }

  return url;
}
