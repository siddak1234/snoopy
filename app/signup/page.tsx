"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl, waitForVerifierCookie } from "@/lib/auth-oauth";
import { isGmailAddress } from "@/lib/email";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function SignupForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";

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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthCallbackUrl(callbackUrl),
          skipBrowserRedirect: true,
        },
      });
      if (!error && data?.url) {
        await waitForVerifierCookie(600, 30);
        window.location.href = data.url;
      }
      return;
    }

    const fullName = (form.elements.namedItem("fullName") as HTMLInputElement | null)?.value?.trim();
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const confirmInput = form.elements.namedItem("confirmPassword") as HTMLInputElement | null;
    const password = passwordInput?.value;
    const confirmPassword = confirmInput?.value;

    if (!password) {
      setStatus("Please choose a password.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          fullName: fullName || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(data?.error ?? "Sign up failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.requiresConfirmation) {
        window.location.replace("/login?verify=1");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setStatus("Account created. Please log in with your email and password.");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setStatus("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">Sign Up</h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-[var(--text)]">
                Full Name
              </label>
              <input
                id="full-name"
                type="text"
                name="fullName"
                autoComplete="name"
                placeholder="Enter your full name"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email"
                className={inputClassName}
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
                autoComplete="new-password"
                placeholder="Choose a password"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--text)]">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={inputClassName}
              />
            </div>

            <button type="submit" className="btn-primary w-full px-5" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
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
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                const { data, error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: buildAuthCallbackUrl("/account"),
                    skipBrowserRedirect: true,
                  },
                });
                if (!error && data?.url) {
                  await new Promise((r) => setTimeout(r, 0));
                  window.location.href = data.url;
                }
              }}
              className="w-full rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
            >
              Sign up with Google
            </button>
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                const { data, error } = await supabase.auth.signInWithOAuth({
                  provider: "azure",
                  options: {
                    redirectTo: buildAuthCallbackUrl("/account"),
                    scopes: "email openid",
                    skipBrowserRedirect: true,
                  },
                });
                if (!error && data?.url) {
                  await new Promise((r) => setTimeout(r, 0));
                  window.location.href = data.url;
                }
              }}
              className="w-full rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
            >
              Sign up with Microsoft
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ring)] pt-5">
            <span className="text-sm text-[var(--muted)]">Already have an account?</span>
            <Link
              href="/login"
              className="btn-secondary inline-flex px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            >
              Log in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center px-4 py-8"><div className="bubble p-6 sm:p-8">Loading…</div></div>}>
      <SignupForm />
    </Suspense>
  );
}
