"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppSession } from "@/hooks/use-app-session";
import { isGmailAddress } from "@/lib/email";
import { FormInput } from "@/components/ui/FormInput";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function LoginForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
              : (authErrorDescription ??
                "Sign-in failed or was cancelled. Please try again.");
        })()
      : null;

  if (searchParams.get("verify") === "1") {
    return <div className="bubble p-6 sm:p-8">Redirecting…</div>;
  }
  if (searchParams.get("deleted") === "1") {
    return <div className="bubble p-6 sm:p-8">Redirecting…</div>;
  }

  // Show "Checking authentication..." while session is loading or during the
  // post-OAuth buffer. Acts as a buffer so we don't flash errors before the
  // session has time to settle.
  const isCheckingAuth = authStatus === "loading";
  if (isCheckingAuth) {
    return <div className="bubble p-6 sm:p-8">Checking authentication…</div>;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem(
      "email",
    ) as HTMLInputElement | null;
    const email = emailInput?.value;

    if (!email?.trim()) {
      setStatus("Please enter your email.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (isGmailAddress(normalizedEmail)) {
      const next = callbackUrl.startsWith("/")
        ? callbackUrl
        : `/${callbackUrl}`;
      window.location.href = `/api/auth/oauth?provider=google&next=${encodeURIComponent(next)}`;
      return;
    }

    const passwordInput = form.elements.namedItem(
      "password",
    ) as HTMLInputElement | null;
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
    <section className="bubble p-6 sm:p-8">
      <h1 className="text-3xl font-medium sm:text-4xl">Login</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <FormInput
          id="email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
          required
        />
        <FormInput
          id="password"
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />

        <button
          type="submit"
          className="btn-primary w-full px-5"
          disabled={loading}
        >
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

      <OAuthDivider />
      <OAuthButtons callbackUrl={callbackUrl} mode="login" />

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ring)] pt-5">
        <span className="text-sm text-[var(--muted)]">New here?</span>
        <Link href="/signup" className="btn-secondary btn-sm">
          Sign Up
        </Link>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bubble p-6 sm:p-8">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
