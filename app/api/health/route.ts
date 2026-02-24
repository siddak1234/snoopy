import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness probe: process is running. Does NOT touch Prisma or the database.
 * Production uses Vercel env vars only; .env.local is local-only.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
