import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prefer pooled connection for runtime (POSTGRES_URL). Fall back to direct
// database URL (POSTGRES_PRISMA_URL) for backwards compatibility.
const connectionString =
  process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL;

const adapter = new PrismaPg({
  // If connectionString is missing, Prisma/pg will throw at runtime with a
  // clear error. We intentionally avoid custom throws here so Next.js builds
  // are not blocked when env is absent during phase-production-build.
  connectionString: connectionString!,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
