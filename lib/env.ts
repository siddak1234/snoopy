/**
 * Environment validation. Call once at app bootstrap.
 * In production, throws if required vars are missing so the app fails fast.
 */
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "POSTGRES_URL",
] as const;

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

export function validateEnv(): void {
  if (!isProductionRuntime()) return;

  const missing = required.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required env in production: ${missing.join(", ")}. See .env.example.`
    );
  }
}

/** Public/safe env (no secrets). Use for client or non-sensitive config. */
export function getPublicEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
}
