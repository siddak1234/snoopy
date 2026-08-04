/**
 * Environment validation. Call once at app bootstrap.
 * In real production, throws if required vars are missing so the app fails
 * fast. Vercel preview deploys often run without the full env (the marketing
 * pages need none of it) — there we warn instead of crashing the server.
 */
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "POSTGRES_URL",
] as const;

function isStrictRuntime(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export function validateEnv(): void {
  const missing = required.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === "";
  });

  if (missing.length === 0) return;

  if (isStrictRuntime()) {
    throw new Error(
      `Missing required env in production: ${missing.join(", ")}. See .env.example.`,
    );
  }

  console.warn(
    `Missing env (${process.env.VERCEL_ENV ?? process.env.NODE_ENV}): ${missing.join(", ")} — auth and database features are disabled.`,
  );
}
