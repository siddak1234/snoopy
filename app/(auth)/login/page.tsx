"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useAppSession } from "@/hooks/use-app-session";
import { safePlatformReturnTo } from "@/lib/platform-api";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = safePlatformReturnTo(searchParams.get("callbackUrl"));
  const authCallbackError = searchParams.get("error") === "auth_callback";
  const { data: session, status } = useAppSession({
    retryIfEmpty: authCallbackError,
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      window.location.replace(callbackUrl);
    }
  }, [status, session?.user, callbackUrl]);

  if (status === "loading") {
    return <div className="bubble p-6 sm:p-8">Checking authentication…</div>;
  }

  return (
    <section className="bubble p-6 sm:p-8">
      <h1 className="text-3xl font-medium sm:text-4xl">Login</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Continue securely with your Google, Microsoft, or Apple account.
      </p>

      {authCallbackError ? (
        <p
          className="mt-5 rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]"
          role="alert"
        >
          Sign-in did not complete. Please try your provider again.
        </p>
      ) : null}

      <div className="mt-6">
        <OAuthButtons callbackUrl={callbackUrl} mode="login" />
      </div>

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
