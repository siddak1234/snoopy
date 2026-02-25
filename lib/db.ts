import { PrismaClient } from "@prisma/client";

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is required");
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL;
}

// POSTGRES_PRISMA_URL (direct connection) is used by Prisma migrations
// POSTGRES_URL (pooled connection) is used by the running application
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
