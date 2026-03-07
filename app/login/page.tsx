"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent, useEffect } from "react";
import { isGmailAddress } from "@/lib/email";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function LoginForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";

  useEffect(() => {
    if (searchParams.get("verify") === "1") {
      window.location.replace("/verify-email");
      return;
    }
    if (searchParams.get("deleted") === "1") {
      window.location.replace("/account-deleted");
    }
  }, [searchParams]);

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const email = emailInput?.value;
    const password = passwordInput?.value;

    if (!email?.trim()) {
      setStatus("Please enter your email.");
      return;
    }
    if (!password) {
      setStatus("Please enter your password.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (isGmailAddress(normalizedEmail)) {
      setLoading(true);
      await signIn("google", { callbackUrl });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setStatus("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }
      if (result?.ok && result?.url) {
        window.location.href = result.url;
        return;
      }
      setStatus("Something went wrong. Please try again.");
    } catch {
      setStatus("Something went wrong. Please try again.");
    }
    setLoading(false);
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

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/account" })}
            className="w-full rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Continue with Google
          </button>

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
