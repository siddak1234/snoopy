"use client";

import { useEffect, useState } from "react";
import { safePlatformReturnTo } from "@/lib/platform-api";
import { platformApiJson, platformApiPath } from "@/lib/platform-api";
import type { operations } from "@/lib/generated/platform-contracts/platform";

type LoginProvidersResponse =
  operations["listLoginProviders"]["responses"][200]["content"]["application/json"];
type LoginProvider = LoginProvidersResponse["providers"][number];

function oauthHref(provider: LoginProvider["id"], callbackUrl: string) {
  const next = safePlatformReturnTo(callbackUrl);
  return `${platformApiPath(
    `/v1/auth/oauth/${provider}/start`,
  )}?return_to=${encodeURIComponent(next)}`;
}

const buttonClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--ring)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none";

/**
 * Provider-only login entry points. The browser follows the Autom8x API route;
 * only the backend communicates with Supabase Auth.
 */
export function OAuthButtons({
  callbackUrl = "/account",
  mode = "login",
}: {
  callbackUrl?: string;
  mode?: "login" | "signup";
}) {
  const [providers, setProviders] = useState<LoginProvider[] | null>(null);
  const [error, setError] = useState(false);
  const verb = mode === "signup" ? "Sign up" : "Continue";

  useEffect(() => {
    let cancelled = false;
    void platformApiJson<LoginProvidersResponse>("/v1/auth/providers")
      .then((response) => {
        if (!cancelled) setProviders(response.providers);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--muted)]">
        Sign-in providers are unavailable right now. Please try again later.
      </p>
    );
  }

  if (!providers) {
    return (
      <p role="status" className="text-sm text-[var(--muted)]">
        Loading sign-in providers…
      </p>
    );
  }

  if (providers.length === 0) {
    return (
      <p role="alert" className="text-sm text-[var(--muted)]">
        No sign-in providers are available in this environment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <a
          key={provider.id}
          href={oauthHref(provider.id, callbackUrl)}
          className={buttonClass}
        >
          {verb} with {provider.label}
        </a>
      ))}
    </div>
  );
}
