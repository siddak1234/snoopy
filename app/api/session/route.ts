import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Returns app session for client-side auth UI. */
export async function GET() {
  const session = await getAppSession();
  return NextResponse.json(session);
}
