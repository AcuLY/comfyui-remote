import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SCHEMAS = ["prisma/schema.prisma", "prisma/schema.sqlite.prisma"] as const;

test("Prisma schemas group models by the roadmap domain comments", () => {
  for (const schemaPath of SCHEMAS) {
    const source = readFileSync(schemaPath, "utf8");

    for (const domain of [
      "Preset library",
      "Training",
      "Generation project templates",
      "Generation projects and sections",
      "Runs, Images, Trash, and Censoring",
      "Assets",
      "Audit and Locks",
    ]) {
      assert.match(source, new RegExp(`// .*${domain}`, "i"), `${schemaPath} missing ${domain} domain comment`);
    }
  }
});
