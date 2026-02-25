import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prefer pooled connection for runtime (POSTGRES_URL). Fall back to direct
// database URL (POSTGRES_PRISMA_URL) for backwards compatibility.
const connectionString =
  process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL;

// Build a pg PoolConfig manually instead of passing the raw connection string,
// so we can fully control TLS options and avoid sslmode parsing issues.
if (!connectionString) {
  throw new Error(
    "Database connection string is missing. Set POSTGRES_URL (pooled) or POSTGRES_PRISMA_URL (direct)."
  );
}

const url = new URL(connectionString);

const adapter = new PrismaPg({
  host: url.hostname,
  port: url.port ? Number(url.port) : 5432,
  database: url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  // Explicit TLS: allow Supabase's managed certificates without strict CA
  // validation, which avoids "self-signed certificate in certificate chain"
  // errors in some serverless environments like Vercel.
  ssl: {
    rejectUnauthorized: false,
  },
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
