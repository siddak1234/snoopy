"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const DEFAULT_NEXT = "/account";

/**
 * When Supabase (or the provider) redirects to the Site URL (often "/") with
 * OAuth result in the URL fragment (#code=..., #access_token=...), the server
 * never receives the fragment. This component redirects to /auth/callback with
 * the fragment params in the query so the server can exchange the code and
 * redirect to the dashboard.
 */
export default function OAuthFragmentRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || pathname !== "/") return;
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const hasAuthParams =
      params.has("code") ||
      params.has("access_token") ||
      (params.has("error") && params.has("error_description"));
    if (!hasAuthParams) return;
    const next = params.get("next")?.trim();
    const targetPath = next && next.startsWith("/") ? next : DEFAULT_NEXT;
    params.set("next", targetPath);
    window.location.replace(`/auth/callback?${params.toString()}`);
  }, [pathname]);

  return null;
}
