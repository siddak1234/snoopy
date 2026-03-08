"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

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

type State = {
  linked: Set<ProviderId>;
  /** Provider used to create the account (first sign-up). */
  primaryProvider: ProviderId | null;
  loading: boolean;
  linking: ProviderId | null;
  error: string | null;
  /** Show "user account already existing" bubble (from linkError=already_exists in URL). */
  showAlreadyExistsModal: boolean;
};

export default function LinkedAccountsSection() {
  const [state, setState] = useState<State>({
    linked: new Set(),
    primaryProvider: null,
    loading: true,
    linking: null,
    error: null,
    showAlreadyExistsModal: false,
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

    setState((s) => ({
      ...s,
      loading: false,
      linked,
      primaryProvider,
    }));
  }, []);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("linkError") === "already_exists") {
      params.delete("linkError");
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState(null, "", newUrl);
      setState((s) => ({ ...s, showAlreadyExistsModal: true }));
    }
  }, []);

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
      {state.showAlreadyExistsModal ? (
        <Modal
          onClose={() => setState((s) => ({ ...s, showAlreadyExistsModal: false }))}
          ariaLabelledBy="link-error-title"
          bubble
        >
          <h2 id="link-error-title" className="text-xl font-semibold text-[var(--text)]">
            User account already existing
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            That sign-in option is already used by another account. Use a different Google or Microsoft account that isn’t already in use.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, showAlreadyExistsModal: false }))}
              className="btn-primary px-4 py-2 text-sm"
            >
              OK
            </button>
          </div>
        </Modal>
      ) : null}
      <ul className="mt-4 space-y-2">
        {PROVIDERS.map(({ id, label }) => {
          const isLinked = state.linked.has(id);
          const isPrimary = state.primaryProvider === id;
          const isLinking = state.linking === id;
          const disabled = isLinked;

          const statusText = isPrimary ? "Primary" : isLinked ? "Secondary" : null;

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
                    {statusText ?? "Linked"}
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
