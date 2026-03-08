"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

type ProviderId = "google" | "azure";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "azure", label: "Microsoft" },
];

/** Supabase may return "azure", "azure_ad", or "microsoft" for Microsoft. Normalize to our ProviderId. */
function normalizeProviderId(provider: string | null | undefined): ProviderId | null {
  if (provider == null || provider === "") return null;
  const p = provider.toLowerCase();
  if (p === "google") return "google";
  if (p === "azure" || p === "azure_ad" || p === "microsoft") return "azure";
  return null;
}

/** Read provider from session JWT (provider_id claim) so we show the actual sign-in method, not the first sign-up provider. */
function getSessionProviderId(accessToken: string | undefined): ProviderId | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { provider_id?: string };
    return normalizeProviderId(payload.provider_id ?? null) ?? null;
  } catch {
    return null;
  }
}

type State = {
  linked: Set<ProviderId>;
  currentProvider: ProviderId | null;
  loading: boolean;
  linking: ProviderId | null;
  error: string | null;
};

export default function LinkedAccountsSection() {
  const [state, setState] = useState<State>({
    linked: new Set(),
    currentProvider: null,
    loading: true,
    linking: null,
    error: null,
  });

  const loadIdentities = useCallback(async () => {
    const supabase = createClient();
    setState((s) => ({ ...s, loading: true, error: null }));

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setState((s) => ({
        ...s,
        loading: false,
        linked: new Set(),
        currentProvider: null,
      }));
      return;
    }

    const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();

    if (identitiesError) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Could not load linked accounts.",
      }));
      return;
    }

    const linked = new Set<ProviderId>();
    const list = identitiesData?.identities ?? [];
    for (const identity of list) {
      const ourId = normalizeProviderId(identity.provider);
      if (ourId) linked.add(ourId);
    }

    // Who signed in right now: JWT provider_id (normalized) > app_metadata.provider (normalized) > single identity if only one linked.
    const appProvider = (user.app_metadata as { provider?: string })?.provider;
    const currentProvider =
      getSessionProviderId(session.access_token) ??
      normalizeProviderId(appProvider ?? undefined) ??
      (list.length === 1 ? normalizeProviderId(list[0].provider) : null);

    setState((s) => ({
      ...s,
      loading: false,
      linked,
      currentProvider,
    }));
  }, []);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  async function handleLink(provider: ProviderId) {
    const supabase = createClient();
    setState((s) => ({ ...s, linking: provider, error: null }));

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account/settings")}`;
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo },
    });

    if (error) {
      setState((s) => ({
        ...s,
        linking: null,
        error: error.message ?? "Could not start linking. Try again.",
      }));
      return;
    }
    // Success: browser redirects to OAuth then back to /auth/callback → /account/settings
  }

  if (state.loading) {
    return (
      <div className="border-t border-[var(--ring)] pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Linked accounts
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--ring)] pt-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        Linked accounts
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Link additional sign-in options to this account. You can sign in with any linked provider.
      </p>
      {state.error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {PROVIDERS.map(({ id, label }) => {
          const isLinked = state.linked.has(id);
          const isCurrent = state.currentProvider === id;
          const isLinking = state.linking === id;
          const disabled = isLinked;

          return (
            <li key={id}>
              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  disabled
                    ? "cursor-default border-[var(--ring)] bg-[var(--surface)] opacity-75"
                    : "cursor-pointer border-[var(--ring)] bg-[var(--card)] transition hover:bg-[var(--surface-hover)] focus-within:ring-2 focus-within:ring-[var(--accent-strong)]"
                }`}
              >
                <span className="text-sm font-medium text-[var(--text)]">{label}</span>
                {disabled ? (
                  <span className="text-xs text-[var(--muted)]">
                    {isCurrent ? "Current sign-in" : "Connected"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLink(id)}
                    disabled={isLinking}
                    className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                  >
                    {isLinking ? "Linking…" : "Link"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
