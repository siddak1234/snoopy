"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
}: {
  provider: "google" | "azure";
  label: string;
  callbackUrl: string;
}) {
  async function handleClick() {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`;
    const options: { redirectTo: string; scopes?: string } = { redirectTo };
    // Supabase Auth requires Azure to return a valid email to create the user; use tenant "common" in Dashboard.
    if (provider === "azure") options.scopes = "email openid";
    await supabase.auth.signInWithOAuth({ provider, options });
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
    >
      {label}
    </button>
  );
}

function LoginForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";
  const { data: session, status: authStatus } = useAppSession();

  const authCallbackError = searchParams.get("error") === "auth_callback";
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

  useEffect(() => {
    if (authCallbackError && !status) {
      const msg =
        authReason === "no_code"
          ? "Sign-in did not complete. Add your production URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (e.g. https://your-domain.com/auth/callback)."
          : authErrorDescription ?? "Sign-in failed or was cancelled. Please try again.";
      setStatus(msg);
    }
  }, [authCallbackError, authReason, authErrorDescription, status]);

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

  // Wait for auth to resolve before showing form. Avoids showing login then
  // redirecting when session was still loading (e.g. first load after deploy).
  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="bubble p-6 sm:p-8">Checking authentication…</div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
        },
      });
      if (error) {
        setStatus(error.message ?? "Sign in failed. Please try again.");
        setLoading(false);
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
            <OAuthButton provider="google" label="Continue with Google" callbackUrl={callbackUrl} />
            <OAuthButton provider="azure" label="Continue with Microsoft" callbackUrl={callbackUrl} />
          </div>

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
