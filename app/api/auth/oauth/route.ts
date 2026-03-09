import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

const PROVIDERS = ["google", "azure"] as const;
const DEFAULT_NEXT = "/account";

function getSafeNext(raw: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === "/") return DEFAULT_NEXT;
  if (!trimmed.startsWith("/")) return DEFAULT_NEXT;
  return trimmed;
}

/**
 * Start OAuth on the server so the PKCE code verifier is set in the same
 * response that redirects to the provider. The browser then has the cookie
 * when it lands on /auth/callback, fixing "PKCE code verifier not found".
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get("provider");
  const nextPath = getSafeNext(requestUrl.searchParams.get("next"));
  const redirectTo = `${requestUrl.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  if (!provider || !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "auth_callback");
    login.searchParams.set("error_description", "Invalid or missing provider");
    return NextResponse.redirect(login.toString());
  }

  // Build redirect response; we'll set Location to the auth URL after signInWithOAuth.
  const loginUrl = new URL("/login", requestUrl.origin);
  const response = NextResponse.redirect(loginUrl.toString(), { status: 302 });

  const cookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: requestUrl.protocol === "https:",
  };

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.headers.get("cookie")
          ? request.headers
              .get("cookie")!
              .split(";")
              .map((c) => {
                const eq = c.trim().indexOf("=");
                const name = eq === -1 ? c.trim() : c.trim().slice(0, eq).trim();
                const value = eq === -1 ? "" : c.trim().slice(eq + 1).trim();
                return { name, value };
              })
          : [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...cookieOptions, ...options })
        );
      },
    },
    cookieOptions,
  });

  const options: { redirectTo: string; scopes?: string } = { redirectTo };
  if (provider === "azure") options.scopes = "email openid";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as "google" | "azure",
    options: { ...options, skipBrowserRedirect: true },
  });

  if (error || !data?.url) {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "auth_callback");
    login.searchParams.set(
      "error_description",
      error?.message ?? "Could not start sign-in"
    );
    return NextResponse.redirect(login.toString());
  }

  response.headers.set("Location", data.url);
  return response;
}
