"use client";

import { useCallback, useEffect, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { platformApiPath } from "@/lib/platform-api";

type ProviderId = "google" | "microsoft" | "apple";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
  { id: "apple", label: "Apple" },
];

type IdentityResponse = {
  identities?: { provider: ProviderId; primary: boolean }[];
};

type State = {
  linked: Set<ProviderId>;
  primaryProvider: ProviderId | null;
  loading: boolean;
  linking: ProviderId | null;
  error: string | null;
};

export default function LinkedAccountsSection() {
  const [state, setState] = useState<State>({
    linked: new Set(),
    primaryProvider: null,
    loading: true,
    linking: null,
    error: null,
  });

  const loadIdentities = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(platformApiPath("/v1/auth/identities"), {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("identity_list_failed");
      const body = (await response.json()) as IdentityResponse;
      const identities = body.identities ?? [];
      setState((current) => ({
        ...current,
        loading: false,
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
    void loadIdentities();
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
        {PROVIDERS.map(({ id, label }) => {
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
