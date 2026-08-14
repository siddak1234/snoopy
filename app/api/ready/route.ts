import { NextResponse } from "next/server";
import {
  PlatformNotConfiguredError,
  platformServerJson,
} from "@/lib/platform-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const body = await platformServerJson<unknown>("/health/ready");
    return NextResponse.json({ status: "ready", backend: body });
  } catch (error) {
    return NextResponse.json(
      {
        status: "not-ready",
        backend:
          error instanceof PlatformNotConfiguredError
            ? "not-configured"
            : "unreachable",
      },
      { status: 503 },
    );
  }
}
