/**
 * Next.js instrumentation — runs once on server startup (before the app serves
 * requests). Production fails closed when the backend gateway origin is absent
 * or malformed. No Supabase or storage credential belongs in this process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
