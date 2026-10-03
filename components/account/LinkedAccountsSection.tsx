"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import {
  loginHref,
  PlatformApiError,
  platformApiJson,
  platformApiPath,
  sessionEnded,
} from "@/lib/platform-api";
import type { operations } from "@/lib/generated/platform-contracts/platform";

type IdentityResponse =
  operations["listLoginIdentities"]["responses"][200]["content"]["application/json"];
type LoginProvidersResponse =
  operations["listLoginProviders"]["responses"][200]["content"]["application/json"];
type Provider = LoginProvidersResponse["providers"][number];
type ProviderId = Provider["id"];

/**
 * An unlink's refusals, in the app's words (build 10), by the reason the
 * platform names (backend 24.11.1). Never a bare problem title.
 */
const UNLINK_REFUSALS: Record<string, string> = {
  primary: "The account you signed up with stays linked.",
  last: "The last sign-in account stays linked.",
  refused: "This sign-in account cannot be unlinked.",
};

function unlinkRefusal(error: unknown): string {
  if (error instanceof PlatformApiError) {
    // A platform from before the SEVENTEENTH promotion has no unlink route: the
    // Edge's unknown-route 404 names the method and path it was asked for. Any
    // other 404 is the account itself, no longer linked.
    if (error.status === 404) {
      return typeof error.details?.method === "string" &&
        typeof error.details?.path === "string"
        ? "Unlinking isn't available yet."
        : "That sign-in account is not linked.";
    }
    const reason = error.details?.reason;
    if (
      error.status === 400 &&
      typeof reason === "string" &&
      Object.hasOwn(UNLINK_REFUSALS, reason)
    ) {
      return UNLINK_REFUSALS[reason];
    }
  }
  return "The account could not be unlinked.";
}

type State = {
  linked: Set<ProviderId>;
  /** The address each linked account's provider reports, where it reports one (backend 24.12.2). */
  emails: Map<ProviderId, string>;
  primaryProvider: ProviderId | null;
  providers: Provider[];
  loading: boolean;
  linking: ProviderId | null;
  /** The account whose Unlink is being confirmed. */
  unlinking: ProviderId | null;
  unlinkPending: boolean;
  error: string | null;
  // The session ended while the page was open: answered by signing in again,
  // not by the generic failure (register F40).
  ended: boolean;
};

export default function LinkedAccountsSection() {
  const pathname = usePathname();
  const [state, setState] = useState<State>({
    linked: new Set(),
    emails: new Map(),
    primaryProvider: null,
    providers: [],
    loading: true,
    linking: null,
    unlinking: null,
    unlinkPending: false,
    error: null,
    ended: false,
  });

  const loadIdentities = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
      ended: false,
    }));
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
        emails: new Map(
          identities.flatMap((identity) =>
            identity.email
              ? [[identity.provider, identity.email] as const]
              : [],
          ),
        ),
        primaryProvider:
          identities.find((identity) => identity.primary)?.provider ?? null,
      }));
    } catch (caught) {
      const ended = sessionEnded(caught);
      setState((current) => ({
        ...current,
        loading: false,
        ended,
        error: ended ? null : "Could not load linked accounts.",
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

  /**
   * Unlink (backend 24.11.1, the owner's build 7 ask), confirmed first. From
   * the browser, through the platform's own path: the answer carries the
   * session's renewed cookie, which a server action would drop. The primary
   * account and the last one are refused upstream with a reason, said in the
   * app's words (`unlinkRefusal`); whatever the answer, what is linked is read
   * again.
   */
  async function confirmUnlink(provider: ProviderId) {
    setState((current) => ({ ...current, unlinkPending: true, error: null }));
    let error: string | null = null;
    let ended = false;
    try {
      await platformApiJson<IdentityResponse>(
        `/v1/auth/identities/${provider}`,
        { method: "DELETE" },
      );
    } catch (caught) {
      ended = sessionEnded(caught);
      error = ended ? null : unlinkRefusal(caught);
    }
    setState((current) => ({
      ...current,
      unlinking: null,
      unlinkPending: false,
      ended,
    }));
    if (!ended) await loadIdentities();
    if (error) setState((current) => ({ ...current, error }));
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
      {state.ended ? (
        <p role="alert" className="mt-2 text-sm text-[var(--error-text)]">
          Your session ended.{" "}
          <Link
            href={loginHref(pathname)}
            className="underline underline-offset-2"
          >
            Sign in again
          </Link>{" "}
          to see your linked accounts.
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {state.providers.map(({ id, label }) => {
          const isLinked = state.linked.has(id);
          const isPrimary = state.primaryProvider === id;
          const isLinking = state.linking === id;
          // Which account it is, so two sign-ins can be told apart.
          const email = isLinked ? state.emails.get(id) : undefined;

          return (
            <li key={id}>
              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isLinked
                    ? "cursor-default border-[var(--ring)] bg-[var(--surface)] opacity-75"
                    : "cursor-pointer border-[var(--ring)] bg-[var(--card)] transition focus-within:ring-2 focus-within:ring-[var(--accent-strong)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--text)]">
                    {label}
                  </span>
                  {email ? (
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {email}
                    </span>
                  ) : null}
                </span>
                {isLinked && isPrimary ? (
                  <span className="text-xs text-[var(--muted)]">Primary</span>
                ) : isLinked ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--muted)]">Linked</span>
                    <button
                      type="button"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          unlinking: id,
                          error: null,
                        }))
                      }
                      disabled={state.unlinkPending}
                      className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-50"
                    >
                      Unlink
                    </button>
                  </div>
                ) : (
                  <a
                    href={linkHref(id)}
                    onClick={() => handleLink(id)}
                    aria-disabled={isLinking}
                    className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-50"
                  >
                    {isLinking ? "Linking…" : "Link"}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {state.unlinking ? (
        <Modal
          onClose={() =>
            setState((current) => ({ ...current, unlinking: null }))
          }
          bubble
          ariaLabelledBy="unlink-title"
          ariaDescribedBy="unlink-description"
          zIndex={100}
          dismissible={!state.unlinkPending}
        >
          <h2
            id="unlink-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Unlink{" "}
            {state.providers.find(({ id }) => id === state.unlinking)?.label ??
              state.unlinking}
            ?
          </h2>
          <p
            id="unlink-description"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            You can still sign in with your other linked accounts, and link this
            one again later.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setState((current) => ({ ...current, unlinking: null }))
              }
              disabled={state.unlinkPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (state.unlinking) void confirmUnlink(state.unlinking);
              }}
              disabled={state.unlinkPending}
            >
              {state.unlinkPending ? "Unlinking…" : "Unlink"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
