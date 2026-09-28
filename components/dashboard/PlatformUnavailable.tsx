"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { loginHref } from "@/lib/platform-api";
import { tryAgainIn } from "@/lib/retry-after";

/**
 * What the account area shows when the platform refused or could not answer —
 * never a sign-out. Backend §12.1 #160: a 429 or a 5xx used to read as "no
 * session", so ordinary use sent signed-in people to `/login`. The session is
 * still there; saying so, and offering the same page again, is the honest answer.
 *
 * `retry` is the error boundary's own (it re-fetches the segment); without one —
 * the account layout, which no boundary above it can catch — a refresh does the
 * same work.
 */
export function PlatformUnavailable({
  busy = false,
  retryAfterSeconds,
  retry,
  sessionKept = true,
}: {
  /** The platform said "too many requests", as opposed to failing. */
  busy?: boolean;
  /** The wait the platform stated with its refusal (`retry-after`), if any. */
  retryAfterSeconds?: number;
  retry?: () => void;
  /**
   * Whether the session is known to be there. A layout knows — a 401 has
   * already sent the person to sign in — but a page's boundary asks first, and
   * until the answer comes it claims nothing about the session (register F60).
   */
  sessionKept?: boolean;
}) {
  const router = useRouter();
  return (
    <section
      role="alert"
      aria-labelledby="platform-unavailable-title"
      className="bubble mx-auto mt-10 flex max-w-lg flex-col gap-3 p-6 sm:p-8"
    >
      <h1
        id="platform-unavailable-title"
        className="text-xl font-medium text-[var(--text)]"
      >
        {busy
          ? "The platform is busy right now"
          : "The platform could not answer just now"}
      </h1>
      <p className="text-sm text-[var(--muted)]">
        {sessionKept
          ? "You have not been signed out, and nothing was lost. "
          : null}
        {tryAgainIn(busy ? retryAfterSeconds : undefined)}
      </p>
      <div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => (retry ? retry() : router.refresh())}
        >
          Try again
        </Button>
      </div>
    </section>
  );
}

/**
 * The session ended while the page was loading (register F60) — the one failure
 * a person answers by signing in again, not by waiting. Says so, and the way
 * back returns to this page.
 */
export function SessionEnded() {
  const pathname = usePathname();
  return (
    <section
      role="alert"
      aria-labelledby="session-ended-title"
      className="bubble mx-auto mt-10 flex max-w-lg flex-col gap-3 p-6 sm:p-8"
    >
      <h1
        id="session-ended-title"
        className="text-xl font-medium text-[var(--text)]"
      >
        Your session has ended
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Sign in again to carry on where you were.
      </p>
      <div>
        <Link
          prefetch={false}
          href={loginHref(pathname)}
          className="btn-primary btn-sm inline-flex"
        >
          Sign in again
        </Link>
      </div>
    </section>
  );
}
