import { PrismaClient } from "@prisma/client";

type PrismaClientSingleton = PrismaClient | undefined;

declare const globalThis: {
  prisma?: PrismaClientSingleton;
} & typeof global;

const prismaClient = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prismaClient;
}

/** Singleton; use only in Node runtime (not Edge). Production gets POSTGRES_PRISMA_URL from Vercel env. */
export const db = prismaClient;

