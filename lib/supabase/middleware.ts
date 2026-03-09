import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const protectedPaths = ["/account", "/dashboard"];

/** OAuth callback params that indicate the provider redirected to the wrong path (e.g. Site URL "/" instead of "/auth/callback"). */
function hasOAuthCallbackParams(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has("code") ||
    (searchParams.has("error") && searchParams.has("error_description"))
  );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;

  // If OAuth redirected to "/" (e.g. Supabase Site URL is root), forward to the auth callback
  // so the session can be exchanged and the user sent to the dashboard.
  if (pathname === "/" && hasOAuthCallbackParams(searchParams)) {
    const callbackUrl = new URL("/auth/callback", request.url);
    searchParams.forEach((value, key) => callbackUrl.searchParams.set(key, value));
    if (!callbackUrl.searchParams.has("next")) callbackUrl.searchParams.set("next", "/account");
    return NextResponse.redirect(callbackUrl);
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProtected && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  // Authenticated users must never see the login page; send them to account home.
  if (pathname === "/login" && user) {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
    const safePath =
      callbackUrl &&
      callbackUrl.startsWith("/") &&
      (callbackUrl === "/account" ||
        callbackUrl.startsWith("/account/") ||
        callbackUrl === "/dashboard" ||
        callbackUrl.startsWith("/dashboard/"))
        ? callbackUrl
        : "/account";
    return NextResponse.redirect(new URL(safePath, request.url));
  }

  return response;
}
