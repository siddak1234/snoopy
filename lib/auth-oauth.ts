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
    .map((s) => (s.trim().split("=")[0] ?? "").trim())
    .filter(
      (name) =>
        name.includes("verifier") ||
        name.includes("auth-token") ||
        name.startsWith("sb-")
    );
}

/** True if at least one Supabase verifier/auth cookie is present (for diagnostics). */
export function hasSupabaseVerifierCookie(): boolean {
  return getSupabaseVerifierCookieNames().length > 0;
}

/**
 * Yield to the event loop so any async cookie write from the auth library
 * (e.g. PKCE verifier) can run before we check document.cookie.
 * First signInWithOAuth often resolves before storage.setItem completes.
 */
function yieldEventLoop(times: number = 3): Promise<void> {
  let chain: Promise<void> = Promise.resolve();
  for (let i = 0; i < times; i++) {
    chain = chain.then(() => new Promise((r) => setTimeout(r, 0)));
  }
  return chain;
}

/**
 * Log cookie state for first vs second attempt comparison.
 * label: "AFTER_SIGNIN" | "BEFORE_NAV"
 */
export function logOAuthCookieState(
  label: "AFTER_SIGNIN" | "BEFORE_NAV",
  dataUrl: string | undefined
): void {
  if (typeof document === "undefined") return;
  const raw = document.cookie;
  const names = raw
    ? raw.split(";").map((s) => (s.trim().split("=")[0] ?? "").trim())
    : [];
  const hasSb = names.some((n) => n.startsWith("sb-"));
  const hasAuthToken = names.some((n) => n.includes("auth-token"));
  const hasVerifier = names.some((n) => n.includes("verifier"));
  console.log(`PKCE_${label}`, {
    dataUrlPresent: Boolean(dataUrl),
    documentCookie: raw,
    cookieNames: names,
    hasSb,
    hasAuthToken,
    hasVerifier,
  });
}

/**
 * Wait for the Supabase PKCE verifier cookie to appear before redirecting.
 * signInWithOAuth can resolve before the cookie is committed; this avoids
 * the callback request missing the verifier.
 *
 * Uses a minimum delay so the auth library has time to write the cookie,
 * then polls. Do not redirect to the provider until this returns true.
 */
export function waitForVerifierCookie(
  maxMs: number = 1200,
  intervalMs: number = 50
): Promise<boolean> {
  return new Promise((resolve) => {
    const minDelayMs = 200;
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
 * Run after signInWithOAuth: log state, yield so auth library can write cookie,
 * wait for verifier cookie, log again. Returns true only if cookie is present.
 * Use this so the first OAuth click creates the cookie before redirect.
 */
export async function ensureVerifierThenRedirect(dataUrl: string | undefined): Promise<boolean> {
  logOAuthCookieState("AFTER_SIGNIN", dataUrl);
  await yieldEventLoop(3);
  const hasVerifier = await waitForVerifierCookie(1200, 50);
  logOAuthCookieState("BEFORE_NAV", dataUrl);
  return hasVerifier;
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

