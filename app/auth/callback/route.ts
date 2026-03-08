import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_NEXT = "/account";

function getSafeNext(raw: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_NEXT;
  if (!trimmed.startsWith("/")) return DEFAULT_NEXT;
  return trimmed;
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
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNext(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "auth_callback");
    if (errorDescription) login.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(login.toString());
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url).toString());
    }
    console.error("AUTH_CALLBACK_EXCHANGE_FAIL", { message: error.message });
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "auth_callback");
    login.searchParams.set("error_description", error.message);
    return NextResponse.redirect(login.toString());
  }

  return new NextResponse(fragmentFallbackHtml(next), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
