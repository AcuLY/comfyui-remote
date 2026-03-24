import { PrismaClient } from "@/generated/prisma";
import { createPrismaClient } from "@/lib/prisma";

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
