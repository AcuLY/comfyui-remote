import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";

export function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });
}
