"use client";

import { Button } from "@/components/ui/Button";
import "./globals.css";

/**
 * The last boundary: the root layout itself failed, so nothing of the site's
 * shell rendered (register F26). It replaces the root layout, so it brings its
 * own document and the global styles; the theme script does not run here, so the
 * page takes the default (dark) tokens.
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen antialiased">
        <main className="px-4">
          <section
            role="alert"
            aria-labelledby="global-error-title"
            className="bubble mx-auto my-16 flex max-w-lg flex-col gap-3 p-6 sm:p-8"
          >
            <h1
              id="global-error-title"
              className="text-xl font-medium text-[var(--text)]"
            >
              Autom8x could not load
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
        </main>
      </body>
    </html>
  );
}
