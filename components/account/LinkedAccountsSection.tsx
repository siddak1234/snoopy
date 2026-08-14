"use client";

import { useCallback, useEffect, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { platformApiJson, platformApiPath } from "@/lib/platform-api";
import type { operations } from "@/lib/generated/platform-contracts/platform";

type IdentityResponse =
  operations["listLoginIdentities"]["responses"][200]["content"]["application/json"];
type LoginProvidersResponse =
  operations["listLoginProviders"]["responses"][200]["content"]["application/json"];
type Provider = LoginProvidersResponse["providers"][number];
type ProviderId = Provider["id"];

type State = {
  linked: Set<ProviderId>;
  primaryProvider: ProviderId | null;
  providers: Provider[];
  loading: boolean;
  linking: ProviderId | null;
  error: string | null;
};

export default function LinkedAccountsSection() {
  const [state, setState] = useState<State>({
    linked: new Set(),
    primaryProvider: null,
    providers: [],
    loading: true,
    linking: null,
    error: null,
  });

  const loadIdentities = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [identityBody, providersBody] = await Promise.all([
        platformApiJson<IdentityResponse>("/v1/auth/identities"),
        platformApiJson<LoginProvidersResponse>("/v1/auth/providers"),
      ]);
      const identities = identityBody.identities;
      setState((current) => ({
        ...current,
        loading: false,
        providers: providersBody.providers,
        linked: new Set(identities.map((identity) => identity.provider)),
        primaryProvider:
          identities.find((identity) => identity.primary)?.provider ?? null,
      }));
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Could not load linked accounts.",
      }));
    }
  }, []);

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      void loadIdentities();
    }, 0);
    return () => clearTimeout(loadTimer);
  }, [loadIdentities]);

  function handleLink(provider: ProviderId) {
    setState((current) => ({
      ...current,
      linking: provider,
      error: null,
    }));
  }

  function linkHref(provider: ProviderId): string {
    return `${platformApiPath(
      `/v1/auth/identities/${provider}/start`,
    )}?return_to=${encodeURIComponent("/account/settings")}`;
  }

  if (state.loading) {
    return (
      <div className="border-t border-[var(--ring)] pt-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Linked accounts
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--ring)] pt-5">
      <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
        Linked accounts
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Link additional sign-in options to this account. Provider credentials
        are handled by the Autom8x backend and never exposed to this page.
      </p>
      {state.error ? (
        <FormError message={state.error} className="mt-2" />
      ) : null}
      <ul className="mt-4 space-y-2">
        {state.providers.map(({ id, label }) => {
          const isLinked = state.linked.has(id);
          const isPrimary = state.primaryProvider === id;
          const isLinking = state.linking === id;

          return (
            <li key={id}>
              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isLinked
                    ? "cursor-default border-[var(--ring)] bg-[var(--surface)] opacity-75"
                    : "cursor-pointer border-[var(--ring)] bg-[var(--card)] transition focus-within:ring-2 focus-within:ring-[var(--accent-strong)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span className="text-sm font-medium text-[var(--text)]">
                  {label}
                </span>
                {isLinked ? (
                  <span className="text-xs text-[var(--muted)]">
                    {isPrimary ? "Primary" : "Linked"}
                  </span>
                ) : (
                  <a
                    href={linkHref(id)}
                    onClick={() => handleLink(id)}
                    aria-disabled={isLinking}
                    className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none disabled:opacity-50"
                  >
                    {isLinking ? "Linking…" : "Link"}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
