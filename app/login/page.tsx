"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/auth-oauth";
import { useAppSession } from "@/hooks/use-app-session";
import { isGmailAddress } from "@/lib/email";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function OAuthButton({
  provider,
  label,
  callbackUrl,
  onOAuthError,
}: {
  provider: "google" | "azure";
  label: string;
  callbackUrl: string;
  onOAuthError?: (message: string | undefined) => void;
}) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    onOAuthError?.(undefined);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildAuthCallbackUrl(callbackUrl),
          ...(provider === "azure" && { scopes: "email openid" }),
        },
      });
      if (error) {
        onOAuthError?.(error.message ?? "Sign-in failed.");
        return;
      }
      // Library stores PKCE verifier when building the URL; redirect so cookie is sent on callback.
      // Small delay so cookie write is committed before navigation (avoids "verifier not found").
      if (data?.url) {
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
        return;
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-70"
    >
      {loading ? "Starting…" : label}
    </button>
  );
}

function LoginForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthError, setOAuthError] = useState<string | undefined>(undefined);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";
  const authCallbackError = searchParams.get("error") === "auth_callback";
  const { data: session, status: authStatus } = useAppSession({
    retryIfEmpty: authCallbackError,
  });

  const authReason = searchParams.get("reason");
  const authErrorDescription = searchParams.get("error_description");

  useEffect(() => {
    if (searchParams.get("verify") === "1") {
      window.location.replace("/verify-email");
      return;
    }
    if (searchParams.get("deleted") === "1") {
      window.location.replace("/account-deleted");
    }
  }, [searchParams]);

  // If already authenticated (e.g. session resolved after a wrong redirect here),
  // send user to dashboard. Prevents flicker when auth state was still loading.
  useEffect(() => {
    if (authStatus === "authenticated" && session?.user) {
      window.location.replace(callbackUrl);
    }
  }, [authStatus, session?.user, callbackUrl]);

  // Derive OAuth callback error message (don't set state in an effect).
  const derivedAuthError =
    authCallbackError && authStatus === "unauthenticated" && !status
      ? (() => {
          const desc = (authErrorDescription ?? "").toLowerCase();
          const isPkceOrVerifier =
            authReason === "no_code" ||
            desc.includes("pkce") ||
            desc.includes("code verifier") ||
            desc.includes("storage");
          return authReason === "no_code"
            ? "Sign-in did not complete. Add your production URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (e.g. https://your-domain.com/auth/callback)."
            : isPkceOrVerifier
              ? "Sign-in could not be completed. This usually means the callback URL in Supabase doesn’t match this site. In Supabase Dashboard → Authentication → URL Configuration, set Redirect URLs to this site’s exact address (e.g. http://localhost:3000/auth/callback for local dev)."
              : authErrorDescription ?? "Sign-in failed or was cancelled. Please try again.";
        })()
      : null;

  if (searchParams.get("verify") === "1") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="bubble p-6 sm:p-8">Redirecting…</div>
      </div>
    );
  }
  if (searchParams.get("deleted") === "1") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="bubble p-6 sm:p-8">Redirecting…</div>
      </div>
    );
  }

  // Show "Checking authentication..." while session is loading or during the
  // post-OAuth buffer. Acts as a buffer so we don't flash errors before the
  // session has time to settle.
  const isCheckingAuth = authStatus === "loading";
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="bubble p-6 sm:p-8">Checking authentication…</div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setOAuthError(undefined);
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const email = emailInput?.value;

    if (!email?.trim()) {
      setStatus("Please enter your email.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (isGmailAddress(normalizedEmail)) {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: buildAuthCallbackUrl(callbackUrl) },
      });
      if (error) {
        setStatus(error.message ?? "Sign in failed. Please try again.");
        setLoading(false);
        return;
      }
      if (data?.url) {
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      }
      return;
    }

    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const password = passwordInput?.value;
    if (!password) {
      setStatus("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setStatus("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setStatus("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">Login</h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email"
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className={inputClassName}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full px-5" disabled={loading}>
              {loading ? "Signing in…" : "Log In"}
            </button>

            {status ? (
              <p className="text-center text-sm text-[var(--muted)]" role="alert">
                {status}
              </p>
            ) : derivedAuthError ? (
              <p className="text-center text-sm text-[var(--muted)]" role="alert">
                {derivedAuthError}
              </p>
            ) : null}
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-[var(--ring)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--surface)] px-3 text-sm text-[var(--muted)]">or</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <OAuthButton
              provider="google"
              label="Continue with Google"
              callbackUrl={callbackUrl}
              onOAuthError={setOAuthError}
            />
            <OAuthButton
              provider="azure"
              label="Continue with Microsoft"
              callbackUrl={callbackUrl}
              onOAuthError={setOAuthError}
            />
          </div>
          {oauthError ? (
            <p className="mt-2 text-center text-sm text-[var(--muted)]" role="alert">
              {oauthError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ring)] pt-5">
            <span className="text-sm text-[var(--muted)]">New here?</span>
            <Link
              href="/signup"
              className="btn-secondary inline-flex px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            >
              Sign Up
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center px-4 py-8"><div className="bubble p-6 sm:p-8">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
