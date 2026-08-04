import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The client is constructed on first query, not at import: `next build`
 * collects page data for API routes in environments without a database
 * (CI, Vercel preview), so requiring POSTGRES_URL at module scope breaks
 * the build there. Runtime behavior is unchanged — the first query still
 * fails fast with the same message when the connection string is missing.
 */
function createPrismaClient(): PrismaClient {
  // Prefer pooled connection for runtime (POSTGRES_URL). Fall back to direct
  // database URL (POSTGRES_PRISMA_URL) for backwards compatibility.
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error(
      "Database connection string is missing. Set POSTGRES_URL (pooled) or POSTGRES_PRISMA_URL (direct).",
    );
  }

  // Build a pg PoolConfig manually instead of passing the raw connection
  // string, so we can fully control TLS options and avoid sslmode parsing
  // issues.
  const url = new URL(connectionString);

  const adapter = new PrismaPg({
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.startsWith("/")
      ? url.pathname.slice(1)
      : url.pathname,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    // Explicit TLS: allow Supabase's managed certificates without strict CA
    // validation, which avoids "self-signed certificate in certificate chain"
    // errors in some serverless environments like Vercel.
    ssl: {
      rejectUnauthorized: false,
    },
  });

  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  return (globalForPrisma.prisma ??= createPrismaClient());
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
