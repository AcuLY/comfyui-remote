import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const INVENTORY_PATH = "docs/repo-inventory.md";
const DOC_INDEX_PATH = "docs/index.md";
const GENERATOR_PATH = "scripts/docs/generate-repo-inventory.ts";
const TEST_PATH = "tests/test-repo-inventory.test.ts";

const INVENTORY_HEADERS = [
  "path",
  "area",
  "owner module",
  "file type",
  "current role",
  "target role",
  "action",
];

const ALLOWED_ACTIONS = new Set(["keep", "move", "split", "rename", "regenerate", "archive", "delete", "document-only"]);

function listExpectedInventoryPaths(): string[] {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

  for (const path of [INVENTORY_PATH, DOC_INDEX_PATH, GENERATOR_PATH, TEST_PATH]) {
    if (existsSync(path) && !tracked.includes(path)) {
      tracked.push(path);
    }
  }

  return [...new Set(tracked)].sort((a, b) => a.localeCompare(b));
}

function parseInventoryRows(): Map<string, Record<(typeof INVENTORY_HEADERS)[number], string>> {
  assert.ok(existsSync(INVENTORY_PATH), `${INVENTORY_PATH} must exist`);

  const source = readFileSync(INVENTORY_PATH, "utf8");
  const headerLine = `| ${INVENTORY_HEADERS.join(" | ")} |`;
  assert.ok(source.includes(headerLine), `${INVENTORY_PATH} must include the required inventory columns`);

  const rows = new Map<string, Record<(typeof INVENTORY_HEADERS)[number], string>>();

  for (const line of source.split("\n")) {
    if (!line.startsWith("| `")) {
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    assert.equal(cells.length, INVENTORY_HEADERS.length, `inventory row has wrong cell count: ${line}`);
    const path = cells[0].replace(/^`|`$/g, "");
    const row = Object.fromEntries(INVENTORY_HEADERS.map((header, index) => [header, cells[index]])) as Record<
      (typeof INVENTORY_HEADERS)[number],
      string
    >;

    assert.ok(!rows.has(path), `${path} appears more than once in ${INVENTORY_PATH}`);
    rows.set(path, row);
  }

  return rows;
}

test("repo inventory classifies every tracked file with the roadmap columns and actions", () => {
  const rows = parseInventoryRows();
  const expectedPaths = listExpectedInventoryPaths();
  const actualPaths = [...rows.keys()].sort((a, b) => a.localeCompare(b));

  assert.deepEqual(
    actualPaths.filter((path) => !expectedPaths.includes(path)),
    [],
    "inventory must not include paths outside git-tracked or current inventory artifacts",
  );
  assert.deepEqual(
    expectedPaths.filter((path) => !rows.has(path)),
    [],
    "inventory must include every git-tracked file and current inventory artifact",
  );

  for (const [path, row] of rows) {
    for (const header of INVENTORY_HEADERS) {
      assert.notEqual(row[header], "", `${path} is missing ${header}`);
      assert.doesNotMatch(row[header], /\|/, `${path} ${header} must not contain a pipe`);
    }
    assert.ok(ALLOWED_ACTIONS.has(row.action), `${path} action must be one of: ${[...ALLOWED_ACTIONS].join(", ")}`);
    assert.notEqual(row["owner module"], "uncategorized", `${path} must have an explicit owner module`);
  }
});

test("repo inventory keeps preset save queue helpers under the preset library owner", () => {
  const rows = parseInventoryRows();

  for (const path of [
    "src/app/assets/presets/use-preset-save-queue.ts",
    "tests/test-preset-save-queue.test.ts",
  ]) {
    assert.equal(rows.get(path)?.["owner module"], "preset-library", `${path} should remain preset-owned`);
  }
});

test("documentation index records dependency, generated-code, runtime-file, and read-first rules", () => {
  assert.ok(existsSync(DOC_INDEX_PATH), `${DOC_INDEX_PATH} must exist`);
  assert.ok(existsSync(GENERATOR_PATH), `${GENERATOR_PATH} must exist`);

  const index = readFileSync(DOC_INDEX_PATH, "utf8");
  assert.match(index, /src\/app\/api\s*->\s*src\/server\/services\s*->\s*src\/server\/repositories\s*->\s*prisma/);
  assert.match(index, /src\/features\/\*/);
  assert.match(index, /src\/components\/\*/);
  assert.match(index, /src\/generated\/\*\*/);
  assert.match(index, /\.next\/\*\*/);
  assert.match(index, /\.deploy\.lock\/\*\*/);

  for (const topic of [
    "architecture",
    "local development",
    "deployment",
    "API contracts",
    "UI design",
    "training",
    "queue/worker behavior",
    "troubleshooting",
  ]) {
    assert.match(index, new RegExp(topic, "i"), `${DOC_INDEX_PATH} must name a read-first source for ${topic}`);
  }
});
