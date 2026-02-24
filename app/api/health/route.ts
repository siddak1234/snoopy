import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check for load balancers and orchestrators.
 * Returns 200 if the app is up; optionally checks DB connectivity.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      { status: "unhealthy", database: "disconnected" },
      { status: 503 }
    );
  }

  return NextResponse.json({ status: "ok", database: "connected" });
}
