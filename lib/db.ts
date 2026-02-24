import { PrismaClient } from "./generated/prisma";

type PrismaClientSingleton = PrismaClient | undefined;

declare const globalThis: {
  prisma?: PrismaClientSingleton;
} & typeof global;

const prismaClient = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prismaClient;
}

export const db = prismaClient;

