import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Browser Supabase client. Uses cookies (via document.cookie) so the PKCE code
 * verifier is available when the OAuth callback runs on the server.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
    },
  });
}
