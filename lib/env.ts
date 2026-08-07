import { backendApiOrigin } from "@/lib/backend-origin";

/** Validate the website's intentionally small production secret boundary. */
export function validateEnv(): void {
  const origin = backendApiOrigin();
  if (!origin) {
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    const isProductionRuntime = process.env.VERCEL_ENV
      ? process.env.VERCEL_ENV === "production"
      : process.env.NODE_ENV === "production" && !isBuild;
    if (isProductionRuntime) {
      throw new Error(
        "Missing BACKEND_API_ORIGIN. The website cannot authenticate or load product data without the backend gateway.",
      );
    }
    return;
  }
}
