import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Default post-login destination so all account types (Google, Microsoft, etc.) behave the same. */
const DEFAULT_NEXT = "/account";

function getSafeNext(raw: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_NEXT;
  // Only allow relative paths to avoid open redirect
  if (!trimmed.startsWith("/")) return DEFAULT_NEXT;
  return trimmed;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNext(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    console.error("AUTH_CALLBACK_PROVIDER_ERROR", { error: errorParam, description: errorDescription });
    const login = new URL("/login", origin);
    login.searchParams.set("error", "auth_callback");
    if (errorDescription) login.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(login.toString());
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("AUTH_CALLBACK_EXCHANGE_FAIL", { message: error.message });
    const login = new URL("/login", origin);
    login.searchParams.set("error", "auth_callback");
    login.searchParams.set("error_description", error.message);
    return NextResponse.redirect(login.toString());
  }

  console.warn("AUTH_CALLBACK_NO_CODE", { pathname: new URL(request.url).pathname });
  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth_callback");
  login.searchParams.set("reason", "no_code");
  return NextResponse.redirect(login.toString());
}
