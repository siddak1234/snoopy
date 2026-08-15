"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { safePlatformReturnTo } from "@/lib/platform-api";

function SignupForm() {
  const searchParams = useSearchParams();
  const callbackUrl = safePlatformReturnTo(searchParams.get("callbackUrl"));

  return (
    <section className="bubble p-6 sm:p-8">
      <h1 className="text-3xl font-medium sm:text-4xl">Sign Up</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Create your Autom8x account through an approved sign-in provider. No
        separate password is required.
      </p>

      <div className="mt-6">
        <OAuthButtons callbackUrl={callbackUrl} mode="signup" />
      </div>

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
