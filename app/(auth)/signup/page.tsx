"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isGmailAddress } from "@/lib/email";
import { FormInput } from "@/components/ui/FormInput";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";

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

    const fullName = (
      form.elements.namedItem("fullName") as HTMLInputElement | null
    )?.value?.trim();
    const passwordInput = form.elements.namedItem(
      "password",
    ) as HTMLInputElement | null;
    const confirmInput = form.elements.namedItem(
      "confirmPassword",
    ) as HTMLInputElement | null;
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
        setStatus(
          "Account created. Please log in with your email and password.",
        );
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
    <section className="bubble p-6 sm:p-8">
      <h1 className="text-3xl font-medium sm:text-4xl">Sign Up</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <FormInput
          id="full-name"
          label="Full Name"
          type="text"
          name="fullName"
          autoComplete="name"
          placeholder="Enter your full name"
        />
        <FormInput
          id="email"
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
        />
        <FormInput
          id="password"
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Choose a password"
        />
        <FormInput
          id="confirm-password"
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Confirm your password"
        />

        <button
          type="submit"
          className="btn-primary w-full px-5"
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>

        {status ? (
          <p className="text-center text-sm text-[var(--muted)]" role="alert">
            {status}
          </p>
        ) : null}
      </form>

      <OAuthDivider />
      <OAuthButtons callbackUrl={callbackUrl} mode="signup" />

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ring)] pt-5">
        <span className="text-sm text-[var(--muted)]">
          Already have an account?
        </span>
        <Link href="/login" className="btn-secondary btn-sm">
          Log in
        </Link>
      </div>
    </section>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="bubble p-6 sm:p-8">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
