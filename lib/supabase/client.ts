import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Cookie options for PKCE/session storage. Must be consistent so the server
 * callback can read the code verifier. Secure in HTTPS so production sends the cookie.
 */
function getCookieOptions(): { path: string; sameSite: "lax"; secure?: boolean } {
  const base = { path: "/", sameSite: "lax" as const };
  if (typeof window !== "undefined" && window.location?.protocol === "https:") {
    return { ...base, secure: true };
  }
  return base;
}

/**
 * Browser Supabase client from @supabase/ssr. Uses cookies (document.cookie)
 * so the PKCE code verifier is available when the OAuth callback runs on the server.
 * Do not use the non-SSR createClient from @supabase/supabase-js in the browser.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getCookieOptions(),
    // Each OAuth start gets a fresh client so the first signInWithOAuth writes the
    // PKCE verifier cookie; the singleton can defer the write until a second use.
    isSingleton: false,
  });
}
