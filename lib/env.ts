/**
 * Environment validation. Call once at app bootstrap (e.g. from auth config).
 * In production, throws if required vars are missing so the app fails fast.
 */
const required = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  // Runtime should use pooled connection; direct URL is for migrations only.
  "POSTGRES_URL",
] as const;

function isProductionRuntime(): boolean {
  // Next.js sets NEXT_PHASE during build/runtime. Build commonly runs with NODE_ENV=production,
  // but should not require runtime secrets just to import modules.
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

export function getRequiredAuthEnv(): {
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
} {
  // Only throws in actual production runtime; safe to import during build.
  validateEnv();

  return {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  };
}

/** Public/safe env (no secrets). Use for client or non-sensitive config. */
export function getPublicEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
  };
}
