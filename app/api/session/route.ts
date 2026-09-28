import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns app session for client-side auth UI. `null` means no session; a
 * platform that refused or failed is a 503, never a `null` that reads as signed
 * out (backend §12.1 #160).
 */
export async function GET() {
  try {
    return NextResponse.json(await getAppSession());
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
