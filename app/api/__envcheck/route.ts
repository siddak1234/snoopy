import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Parse host:port from a postgres URL; never return credentials. */
function safeHostPort(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const port = u.port || (u.protocol === "postgresql:" ? "5432" : "");
    return port ? `${u.hostname}:${port}` : u.hostname;
  } catch {
    return null;
  }
}

/** TEMPORARY: verify env vars and hosts. DELETE this route after verification. */
export async function GET() {
  const postgresUrl = process.env.POSTGRES_URL;
  const prismaUrl = process.env.POSTGRES_PRISMA_URL;
  return NextResponse.json({
    POSTGRES_URL_exists: Boolean(postgresUrl),
    POSTGRES_PRISMA_URL_exists: Boolean(prismaUrl),
    POSTGRES_URL_host: safeHostPort(postgresUrl),
    POSTGRES_PRISMA_URL_host: safeHostPort(prismaUrl),
  });
}
