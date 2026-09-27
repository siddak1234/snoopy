import { NextResponse, type NextRequest } from "next/server";
import { fetchPlatformSessionForProxy } from "@/lib/platform-proxy";

function loginRedirect(request: NextRequest): NextResponse {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  destination.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(destination);
}

export default async function proxy(request: NextRequest) {
  // No cookie at all is no session. Asking the Edge would spend the website's
  // shared address bucket (backend ADR-0029) on a visitor who is plainly signed
  // out — and, when that bucket is spent, show them "busy" instead of sign-in.
  if (!request.headers.get("cookie")) return loginRedirect(request);

  const sessionResponse = await fetchPlatformSessionForProxy(request.headers);

  // **Only "no session" goes to sign-in — backend §12.1 #160.** A 401 is the Edge
  // saying there is none, and a site with no platform has none. A refusal (429),
  // a failure (5xx) or no answer is NOT a sign-out: the request goes on, and the
  // page's own session read renders "the platform could not answer" instead.
  if (sessionResponse === "not-configured" || sessionResponse?.status === 401) {
    return loginRedirect(request);
  }
  if (!sessionResponse?.ok) return NextResponse.next();

  const headers = sessionResponse.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headers.getSetCookie?.() ?? [];
  const requestHeaders = new Headers(request.headers);
  if (setCookies.length > 0) {
    requestHeaders.set(
      "cookie",
      mergeResponseCookies(request.headers.get("cookie"), setCookies),
    );
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const value of setCookies) response.headers.append("set-cookie", value);
  return response;
}

/**
 * Make a refreshed backend session visible to server components in this same
 * request. The response still carries the original Set-Cookie headers so the
 * browser receives the rotation for subsequent requests.
 */
function mergeResponseCookies(
  currentHeader: string | null,
  setCookieHeaders: readonly string[],
): string {
  const values = new Map<string, string>();
  for (const segment of currentHeader?.split(";") ?? []) {
    const separator = segment.indexOf("=");
    if (separator < 1) continue;
    values.set(
      segment.slice(0, separator).trim(),
      segment.slice(separator + 1).trim(),
    );
  }

  for (const header of setCookieHeaders) {
    const pair = header.split(";", 1)[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (/;\s*Max-Age=0(?:;|$)/i.test(header)) values.delete(name);
    else values.set(name, value);
  }

  return [...values].map(([name, value]) => `${name}=${value}`).join("; ");
}

export const config = {
  matcher: ["/account/:path*", "/onboarding/:path*"],
};
