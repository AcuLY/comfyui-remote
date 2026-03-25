import { PrismaClient } from "@/generated/prisma/client";

// Re-export the PrismaClient type from the PostgreSQL schema (the superset)
// so that all application code can use a single import path for types.
// At runtime we may actually instantiate the SQLite client — the two are
// structurally compatible (same models/fields), just different providers.
export type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Detect the database provider from environment variables.
 *
 * Resolution order:
 *   1. DB_PROVIDER env var ("postgresql" | "sqlite")
 *   2. Inferred from DATABASE_URL prefix
 *   3. Default: "postgresql"
 */
export function detectProvider(): "postgresql" | "sqlite" {
  const explicit = process.env.DB_PROVIDER?.toLowerCase();
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";

  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.endsWith(".db") || url.endsWith(".sqlite")) {
    return "sqlite";
  }

  return "postgresql";
}

function createAdapter() {
  const provider = detectProvider();

  if (provider === "sqlite") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@prisma/adapter-better-sqlite3");
    return new mod.PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  }

  // PostgreSQL (default)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@prisma/adapter-pg");
  return new mod.PrismaPg({ connectionString: process.env.DATABASE_URL! });
}

/**
 * Create a PrismaClient with the appropriate driver adapter.
 *
 * When DB_PROVIDER=sqlite, we instantiate the PrismaClient from the
 * SQLite-specific generated client (src/generated/prisma-sqlite/) so that the
 * embedded `activeProvider` matches the driver adapter.  For PostgreSQL we use
 * the default generated client (src/generated/prisma/).
 *
 * Exported for use in seed scripts and other standalone entry points
 * that need their own client instance.
 */
export function createPrismaClient(): PrismaClient {
  const adapter = createAdapter();
  const provider = detectProvider();

  if (provider === "sqlite") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: SqliteClient } = require("@/generated/prisma-sqlite/client");
    return new SqliteClient({ adapter }) as PrismaClient;
  }

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
