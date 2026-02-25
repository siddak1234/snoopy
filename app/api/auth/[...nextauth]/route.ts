import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

function buildHandler() {
  return NextAuth(getAuthOptions());
}

export async function GET(req: unknown, ctx: unknown) {
  return buildHandler()(req as never, ctx as never);
}

export async function POST(req: unknown, ctx: unknown) {
  return buildHandler()(req as never, ctx as never);
}
