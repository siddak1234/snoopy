/**
 * Next.js instrumentation — runs once on server startup (before the app serves
 * requests). Wires lib/env.ts so production fails fast when required env is
 * missing (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, POSTGRES_URL).
 *
 * validateEnv() throws only in the real production runtime (never during the
 * build phase; Vercel previews warn instead), so local dev and `next build`
 * are unaffected.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
