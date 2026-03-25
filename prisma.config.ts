// Prisma configuration — supports both PostgreSQL and SQLite.
//
// Set DB_PROVIDER=sqlite in .env to use SQLite, or leave unset for PostgreSQL.
// The schema file, migration directory, and generated client output are chosen
// based on the provider:
//   - PostgreSQL → prisma/schema.prisma       → src/generated/prisma/
//   - SQLite    → prisma/schema.sqlite.prisma → src/generated/prisma-sqlite/
//
// You must run `prisma generate` with the correct DB_PROVIDER to produce the
// matching client. Both clients can coexist; the runtime picks the right one.

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
