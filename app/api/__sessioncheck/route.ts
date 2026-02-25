import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** TEMPORARY: verify session has userId + workspaceId. DELETE this route after verification. */
export async function GET() {
  const session = await getServerSession(getAuthOptions());
  return NextResponse.json({
    userId: session?.user?.id ?? null,
    workspaceId: session?.user?.workspaceId ?? null,
  });
}
