/**
 * Next.js instrumentation — runs once on server startup (before the app serves
 * requests). Wires lib/env.ts so production fails fast when required env is
 * missing (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, POSTGRES_URL).
 *
 * validateEnv() no-ops outside the production runtime (and during the build
 * phase), so local dev and `next build` are unaffected. See docs/AUTH-AUDIT-REPORT.md.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
