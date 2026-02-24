import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Readiness probe: DB check only at request time. No top-level db import.
 * When POSTGRES_PRISMA_URL is set (Vercel env), runs SELECT 1; otherwise 200 + database:"skipped".
 */
export async function GET() {
  if (!process.env.POSTGRES_PRISMA_URL) {
    return NextResponse.json({ status: "ok", database: "skipped" });
  }

  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json(
      { status: "error", database: "disconnected" },
      { status: 503 }
    );
  }
}
