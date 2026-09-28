"use client";

import { Button } from "@/components/ui/Button";

/**
 * A page outside the account area that failed to render — a marketing page, the
 * sign-in pages, onboarding. Without it Next showed its own unstyled error page
 * (register F26). The account area has its own boundary, which keeps the
 * account's navigation and says the platform could not answer; this one says
 * only what is known — the page did not load — and offers the same page again.
 *
 * `retry` re-fetches and re-renders the segment. The error itself is not shown:
 * a server error reaches the browser as a generic message and a digest.
 */
export default function RouteError({ retry }: { retry: () => void }) {
  return (
    <section
      role="alert"
      aria-labelledby="route-error-title"
      className="bubble mx-auto my-16 flex max-w-lg flex-col gap-3 p-6 sm:p-8"
    >
      <h1
        id="route-error-title"
        className="text-xl font-medium text-[var(--text)]"
      >
        This page could not load
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Nothing you did caused this. Try again, or come back in a moment.
      </p>
      <div>
        <Button variant="primary" size="sm" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </section>
  );
}
