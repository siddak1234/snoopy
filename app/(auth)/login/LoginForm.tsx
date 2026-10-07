"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  OAuthButtons,
  type LoginProvider,
} from "@/components/auth/OAuthButtons";
import { useAppSession } from "@/hooks/use-app-session";
import { linkFailureHref, signInFailure } from "@/lib/auth-callback-errors";
import { safePlatformReturnTo } from "@/lib/platform-api";

export function LoginForm({
  providers,
}: {
  /** Read on the server and cached; absent when that read failed. */
  providers?: LoginProvider[];
}) {
  const searchParams = useSearchParams();
  const callbackUrl = safePlatformReturnTo(searchParams.get("callbackUrl"));
  const authCallbackError = searchParams.get("error") === "auth_callback";
  // Why, as the platform names it (build 14, decision 10A): said in words, never raw.
  const reason = searchParams.get("reason");
  const { data: session, status } = useAppSession({
    retryIfEmpty: authCallbackError,
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // Signed in already, a refused callback was a link: back to the linked
      // accounts, where its reason is said, rather than on past it unsaid.
      window.location.replace(
        authCallbackError ? linkFailureHref(reason) : callbackUrl,
      );
    }
  }, [status, session?.user, callbackUrl, authCallbackError, reason]);

  if (status === "loading") {
    return <div className="bubble p-6 sm:p-8">Checking authentication…</div>;
  }

  return (
    <section className="bubble p-6 sm:p-8">
      <h1 className="text-3xl font-medium sm:text-4xl">Continue to Autom8x</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Sign in with an approved provider. Your first sign-in creates your
        account — no separate password needed.
      </p>

      {authCallbackError ? (
        <p
          className="mt-5 rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]"
          role="alert"
        >
          {signInFailure(reason)}
        </p>
      ) : null}

      <div className="mt-6">
        <OAuthButtons callbackUrl={callbackUrl} initialProviders={providers} />
      </div>
    </section>
  );
}
