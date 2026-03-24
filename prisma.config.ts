// Prisma configuration — supports both PostgreSQL and SQLite.
//
// Set DB_PROVIDER=sqlite in .env to use SQLite, or leave unset for PostgreSQL.
// The schema file and migration directory are chosen based on the provider.
//
// Note: `prisma generate` always uses the PostgreSQL schema (the superset)
// to produce a single Client that works with both providers. Migrations use
// the provider-specific schema.

import "dotenv/config";
import { defineConfig } from "prisma/config";

const provider = (process.env.DB_PROVIDER ?? "postgresql").toLowerCase();
const isSqlite = provider === "sqlite";

export default defineConfig({
  schema: isSqlite
    ? "prisma/schema.sqlite.prisma"
    : "prisma/schema.prisma",
  migrations: {
    path: isSqlite
      ? "prisma/migrations-sqlite"
      : "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
