"use client";

import { useEffect, useState } from "react";
import { safePlatformReturnTo } from "@/lib/platform-api";
import { platformApiJson, platformApiPath } from "@/lib/platform-api";
import type { operations } from "@/lib/generated/platform-contracts/platform";

type LoginProvidersResponse =
  operations["listLoginProviders"]["responses"][200]["content"]["application/json"];
export type LoginProvider = LoginProvidersResponse["providers"][number];

function oauthHref(provider: LoginProvider["id"], callbackUrl: string) {
  const next = safePlatformReturnTo(callbackUrl);
  return `${platformApiPath(
    `/v1/auth/oauth/${provider}/start`,
  )}?return_to=${encodeURIComponent(next)}`;
}

const buttonClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--ring)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]";

/**
 * Provider-only login entry points. The browser follows the Autom8x API route;
 * only the backend communicates with Supabase Auth.
 */
export function OAuthButtons({
  callbackUrl = "/account",
  initialProviders,
}: {
  callbackUrl?: string;
  /**
   * The list the server already read and cached (backend §12.1 #160). When it is
   * here the browser does not ask again; when it is not — the server's read
   * failed — the browser asks, as it always did.
   */
  initialProviders?: LoginProvider[];
}) {
  const [providers, setProviders] = useState<LoginProvider[] | null>(
    initialProviders ?? null,
  );
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt === 0 && initialProviders) return;
    let cancelled = false;
    void platformApiJson<LoginProvidersResponse>("/v1/auth/providers")
      .then((response) => {
        if (!cancelled) setProviders(response.providers);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, initialProviders]);

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-[var(--muted)]">
          Sign-in providers could not be loaded.
        </p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((current) => current + 1);
          }}
          className="btn-secondary btn-sm"
        >
          Try again
        </button>
      </div>
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
          Continue with {provider.label}
        </a>
      ))}
    </div>
  );
}
