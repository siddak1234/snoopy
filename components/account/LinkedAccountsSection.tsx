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
  /** Provider used to create the account (first sign-up). */
  primaryProvider: ProviderId | null;
  /** Provider used for this session. */
  currentProvider: ProviderId | null;
  loading: boolean;
  linking: ProviderId | null;
  error: string | null;
};

export default function LinkedAccountsSection() {
  const [state, setState] = useState<State>({
    linked: new Set(),
    primaryProvider: null,
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
        primaryProvider: null,
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

    // Primary = account was created with this provider (first sign-up). From app_metadata.
    const appProvider = (user.app_metadata as { provider?: string })?.provider;
    const primaryProvider = normalizeProviderId(appProvider ?? undefined);

    // Current = provider used for this session. Prefer JWT provider_id; if missing (e.g. Azure),
    // use the identity with the most recent last_sign_in_at so it updates when they sign in with the linked account.
    const fromJwt = getSessionProviderId(session.access_token);
    type IdentityWithProvider = { provider?: string; last_sign_in_at?: string };
    const fromLastSignIn =
      list.length > 0
        ? (() => {
            const supported = list.filter(
              (i: IdentityWithProvider) => normalizeProviderId(i.provider) != null
            ) as IdentityWithProvider[];
            if (supported.length === 0) return null;
            const latest = supported.reduce((a, b) => {
              const aAt = a.last_sign_in_at ?? "";
              const bAt = b.last_sign_in_at ?? "";
              return aAt >= bAt ? a : b;
            });
            return normalizeProviderId(latest.provider);
          })()
        : null;
    const currentProvider =
      fromJwt ?? fromLastSignIn ?? (list.length === 1 ? normalizeProviderId(list[0].provider) : null);

    setState((s) => ({
      ...s,
      loading: false,
      linked,
      primaryProvider,
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
    const options: { redirectTo: string; scopes?: string } = { redirectTo };
    if (provider === "azure") options.scopes = "email openid";
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options,
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
          const isPrimary = state.primaryProvider === id;
          const isLinking = state.linking === id;
          const disabled = isLinked;

          const roleLabel = isPrimary ? "Primary" : isLinked ? "Secondary" : null;
          const statusParts = [roleLabel, isCurrent ? "Current sign-in" : null].filter(
            (s): s is string => s != null
          );
          const statusText = statusParts.length > 0 ? statusParts.join(" · ") : null;

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
                    {statusText ?? "Connected"}
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
