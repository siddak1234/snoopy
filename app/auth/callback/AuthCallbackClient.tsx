"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const DEFAULT_NEXT = "/account";

/**
 * Handles OAuth callback when the code is in the URL fragment (e.g. some providers
 * or Supabase configs redirect with #code=... which the server never receives).
 * Exchanges the code in the browser (PKCE verifier is here) then redirects.
 */
export default function AuthCallbackClient() {
  const [status, setStatus] = useState<"exchanging" | "done" | "error">("exchanging");

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);
    const code = hashParams.get("code") ?? searchParams.get("code");
    const nextRaw = hashParams.get("next") ?? searchParams.get("next");
    const next =
      nextRaw?.trim().startsWith("/") === true ? nextRaw.trim() : DEFAULT_NEXT;

    if (!code) {
      window.location.href = `/login?error=auth_callback&reason=no_code`;
      return;
    }

    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setStatus("error");
          const params = new URLSearchParams({
            error: "auth_callback",
            error_description: error.message,
          });
          window.location.href = `/login?${params.toString()}`;
          return;
        }
        setStatus("done");
        window.location.replace(next);
      })
      .catch(() => {
        setStatus("error");
        window.location.href = "/login?error=auth_callback&reason=exchange_failed";
      });
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="bubble p-6 sm:p-8">
        {status === "exchanging" && <p>Completing sign-in…</p>}
        {status === "done" && <p>Redirecting…</p>}
        {status === "error" && <p>Something went wrong. Redirecting to login…</p>}
      </div>
    </div>
  );
}
