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
    console.log("OAUTH_START", { origin, next: normalizedNext, redirectTo: url });
  }

  return url;
}

/** Cookie names in document.cookie that indicate a Supabase PKCE verifier was set. */
function getSupabaseVerifierCookieNames(): string[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((s) => s.trim().split("=")[0] ?? "")
    .filter((name) => name.includes("verifier") || name.includes("auth-token"));
}

/** True if at least one Supabase verifier/auth cookie is present (for diagnostics). */
export function hasSupabaseVerifierCookie(): boolean {
  return getSupabaseVerifierCookieNames().length > 0;
}

/**
 * Wait for the Supabase PKCE verifier cookie to appear before redirecting.
 * signInWithOAuth can resolve before the cookie is committed; this avoids
 * the callback request missing the verifier.
 */
export function waitForVerifierCookie(
  maxMs: number = 400,
  intervalMs: number = 25
): Promise<boolean> {
  return new Promise((resolve) => {
    if (hasSupabaseVerifierCookie()) {
      resolve(true);
      return;
    }
    const deadline = Date.now() + maxMs;
    const t = setInterval(() => {
      if (hasSupabaseVerifierCookie()) {
        clearInterval(t);
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(t);
        resolve(false);
      }
    }, intervalMs);
  });
}

