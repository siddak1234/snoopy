import { PrismaClient } from "@prisma/client";

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL missing: runtime DB connection not configured");
}

// POSTGRES_PRISMA_URL (direct connection) is used by Prisma migrations
// POSTGRES_URL (pooled connection) is used by the running application
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.POSTGRES_URL } },
  } as ConstructorParameters<typeof PrismaClient>[0]);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
