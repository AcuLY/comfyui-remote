import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

test("Prisma generate scripts explicitly cover PostgreSQL and SQLite providers", () => {
  assert.equal(packageJson.scripts?.["prisma:generate"], "DB_PROVIDER=postgresql prisma generate");
  assert.equal(packageJson.scripts?.["prisma:generate:sqlite"], "DB_PROVIDER=sqlite prisma generate");
  assert.equal(
    packageJson.scripts?.["prisma:generate:all"],
    "DB_PROVIDER=postgresql prisma generate && DB_PROVIDER=sqlite prisma generate",
  );
});
