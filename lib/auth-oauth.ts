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
 *
 * Uses a short minimum delay so the auth library has a tick to write the cookie,
 * then polls for the cookie name. Increase maxMs if the callback still misses
 * the verifier on slow devices.
 */
export function waitForVerifierCookie(
  maxMs: number = 600,
  intervalMs: number = 30
): Promise<boolean> {
  return new Promise((resolve) => {
    const minDelayMs = 80;
    const started = Date.now();

    function check() {
      if (hasSupabaseVerifierCookie()) {
        resolve(true);
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed >= maxMs) {
        resolve(false);
        return;
      }
      setTimeout(check, intervalMs);
    }

    setTimeout(check, minDelayMs);
  });
}

/**
 * Temporary diagnostic: snapshot of document.cookie and checks for Supabase
 * verifier/auth cookies, for comparison with callback request cookies.
 * Call immediately after signInWithOAuth resolves and before navigation.
 */
export function logPkceClientSnapshot(redirectTo: string): void {
  if (typeof document === "undefined") return;
  const raw = document.cookie;
  const names = raw
    ? raw.split(";").map((s) => (s.trim().split("=")[0] ?? "").trim())
    : [];
  const hasVerifier = names.some((n) => n.includes("verifier"));
  const hasSupabase = names.some((n) => n.toLowerCase().includes("supabase"));
  const hasAuthToken = names.some((n) => n.includes("auth-token"));
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  console.log("PKCE_DEBUG_CLIENT", {
    documentCookie: raw,
    cookieNames: names,
    hasVerifier,
    hasSupabase,
    hasAuthToken,
    redirectTo,
    windowLocationOrigin: origin,
  });
}

