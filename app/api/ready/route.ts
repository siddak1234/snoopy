import { NextResponse } from "next/server";
import { backendApiOrigin } from "@/lib/backend-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const origin = backendApiOrigin();
  if (!origin) {
    return NextResponse.json(
      { status: "not-ready", backend: "not-configured" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${origin}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    const body = await response.json().catch(() => null);
    return NextResponse.json(
      { status: response.ok ? "ready" : "not-ready", backend: body },
      { status: response.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { status: "not-ready", backend: "unreachable" },
      { status: 503 },
    );
  }
}
