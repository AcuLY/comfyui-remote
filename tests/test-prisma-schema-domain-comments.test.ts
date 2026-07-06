import assert from "node:assert/strict";
import test from "node:test";
import {
  PRISMA_SCHEMA_PATHS,
  readPrismaSchemaSource,
} from "./fixtures/prisma-schema-source";

test("Prisma schemas group models by the roadmap domain comments", () => {
  for (const schemaPath of PRISMA_SCHEMA_PATHS) {
    const source = readPrismaSchemaSource(schemaPath);

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
