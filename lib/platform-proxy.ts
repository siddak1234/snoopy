import { backendApiOrigin } from "@/lib/backend-origin";

/**
 * Proxy-only session transport.
 *
 * The proxy has to preserve Set-Cookie headers from a rotating backend session
 * so Server Components can see the refreshed cookie in the same request. That
 * makes it intentionally distinct from the ordinary server JSON facade.
 */
export async function fetchPlatformSessionForProxy(
  requestHeaders: Headers,
): Promise<Response | null> {
  const origin = backendApiOrigin();
  if (!origin) return null;

  return fetch(`${origin}/v1/session`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-request-id": requestHeaders.get("x-request-id") ?? crypto.randomUUID(),
    },
    cache: "no-store",
  }).catch(() => null);
}
