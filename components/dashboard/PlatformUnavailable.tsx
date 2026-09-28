"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
}: {
  /** The platform said "too many requests", as opposed to failing. */
  busy?: boolean;
  /** The wait the platform stated with its refusal (`retry-after`), if any. */
  retryAfterSeconds?: number;
  retry?: () => void;
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
        You have not been signed out, and nothing was lost.{" "}
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
