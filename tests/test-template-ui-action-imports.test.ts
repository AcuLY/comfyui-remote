import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("templates list imports server actions from focused modules", () => {
  const source = readSource("src/app/assets/templates/templates-list-client.tsx");

  assert.match(source, /from "@\/lib\/actions\/template-crud";/);
  assert.doesNotMatch(source, /from "@\/lib\/actions";/);
});
