import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

const DEFAULT_NEXT = "/account";

function getSafeNext(raw: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === "/") return DEFAULT_NEXT;
  if (!trimmed.startsWith("/")) return DEFAULT_NEXT;
  return trimmed;
}

/** True if the error indicates the identity is already linked to another user (link flow). */
function isLinkAlreadyExistsError(message: string | null | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.length > 0 &&
    msg.includes("already") &&
    (msg.includes("linked") ||
      msg.includes("exists") ||
      msg.includes("registered") ||
      msg.includes("user") ||
      msg.includes("account"))
  );
}

/**
 * After successful code exchange we return 200 + HTML with Set-Cookie instead of
 * a 302 redirect. The browser commits the session cookies when it processes this
 * response; the script then does a client-side redirect. That way the next request
 * (to /account) includes the cookies, avoiding a race where the account layout
 * runs before the session is visible and redirects back to /login.
 */
function successRedirectHtml(destinationUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
  <p>Completing sign-in…</p>
  <script>window.location.replace(${JSON.stringify(destinationUrl)});</script>
</body>
</html>`;
}

/**
 * When Supabase (or the provider) redirects with the code in the URL fragment
 * (#code=...), the server never receives it. This HTML runs in the browser and
 * rewrites the URL so the code is in the query; a reload then hits the server
 * with the code so we can exchange and set cookies.
 */
function fragmentFallbackHtml(nextFromQuery: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
  <p>Completing sign-in…</p>
  <script>
    (function() {
      var hash = window.location.hash.slice(1);
      var search = window.location.search.slice(1);
      if (!hash) {
        window.location.href = "/login?error=auth_callback&reason=no_code";
        return;
      }
      var params = new URLSearchParams(search);
      new URLSearchParams(hash).forEach(function(v, k) { params.set(k, v); });
      var next = params.get("next") || ${JSON.stringify(nextFromQuery)};
      if (!next.startsWith("/")) next = ${JSON.stringify(DEFAULT_NEXT)};
      params.set("next", next);
      window.location.replace("/auth/callback?" + params.toString());
    })();
  </script>
</body>
</html>`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const next = getSafeNext(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    const isLinkFlow =
      next === "/account/settings" ||
      searchParams.get("flow") === "link";
    if (
      isLinkFlow &&
      (isLinkAlreadyExistsError(errorDescription) ||
        isLinkAlreadyExistsError(errorParam))
    ) {
      const settings = new URL("/account/settings", requestUrl.origin);
      settings.searchParams.set("linkError", "already_exists");
      return NextResponse.redirect(settings.toString());
    }
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "auth_callback");
    if (errorDescription) login.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(login.toString());
  }

  if (code) {
    const destinationUrl = new URL(next, requestUrl.origin).toString();
    // Use 200 + HTML with client redirect so the browser commits Set-Cookie before
    // navigating. A 302 would let the browser follow the redirect before cookies
    // are always visible on the next request (e.g. first load after deploy).
    const response = new NextResponse(successRedirectHtml(destinationUrl), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options ?? {})
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error("AUTH_CALLBACK_EXCHANGE_FAIL", { message: error.message });
    if (isLinkAlreadyExistsError(error.message) && next === "/account/settings") {
      const settings = new URL("/account/settings", requestUrl.origin);
      settings.searchParams.set("linkError", "already_exists");
      return NextResponse.redirect(settings.toString());
    }
    // On any exchange failure, if we already have a valid session (e.g. duplicate
    // callback, or code verifier was missing but session exists from a prior flow),
    // redirect to account home instead of showing login with an error.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return NextResponse.redirect(destinationUrl);
    }
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "auth_callback");
    login.searchParams.set("error_description", error.message);
    return NextResponse.redirect(login.toString());
  }

  return new NextResponse(fragmentFallbackHtml(next), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
