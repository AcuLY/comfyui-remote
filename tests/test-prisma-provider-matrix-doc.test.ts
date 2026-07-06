import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const docPath = "docs/prisma-provider-matrix.md";

test("Prisma provider matrix documents PostgreSQL, SQLite, and test database flows", () => {
  const doc = readFileSync(docPath, "utf8");

  for (const required of [
    "PostgreSQL",
    "SQLite",
    "test-only",
    "prisma/schema.prisma",
    "prisma/schema.sqlite.prisma",
    "prisma/migrations",
    "prisma/migrations-sqlite",
    "src/generated/prisma/",
    "src/generated/prisma-sqlite/",
    "DB_PROVIDER=postgresql",
    "DB_PROVIDER=sqlite",
    "DATABASE_URL=file:./data/comfyui.db",
    "npm run prisma:generate",
    "npm run prisma:generate:sqlite",
    "npm run prisma:generate:all",
    "npm run prisma:migrate",
    "npm run prisma:db:push",
    "tests/test-zero-redundancy-schema-shape.test.ts",
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${docPath} missing ${required}`);
  }
});

test("Prisma provider matrix stays linked from the documentation index", () => {
  const index = readFileSync("docs/index.md", "utf8");

  assert.match(index, new RegExp(docPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Prisma provider scripts remain aligned with the provider matrix", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.["prisma:generate"], "DB_PROVIDER=postgresql prisma generate");
  assert.equal(packageJson.scripts?.["prisma:generate:sqlite"], "DB_PROVIDER=sqlite prisma generate");
  assert.equal(
    packageJson.scripts?.["prisma:generate:all"],
    "DB_PROVIDER=postgresql prisma generate && DB_PROVIDER=sqlite prisma generate",
  );
  assert.equal(packageJson.scripts?.["prisma:migrate"], "prisma migrate dev");
  assert.equal(packageJson.scripts?.["prisma:db:push"], "prisma db push");
});
