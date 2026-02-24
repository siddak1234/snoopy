/**
 * Environment validation. Call once at app bootstrap (e.g. from auth config).
 * In production, throws if required vars are missing so the app fails fast.
 */
const required = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "POSTGRES_PRISMA_URL",
] as const;

export function validateEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

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
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
  };
}
