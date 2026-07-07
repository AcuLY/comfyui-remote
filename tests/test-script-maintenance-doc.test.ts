import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const SCRIPT_DOC_PATH = "docs/script-maintenance.md";
const DOC_INDEX_PATH = "docs/index.md";
const REQUIRED_COLUMNS = [
  "script",
  "owner",
  "purpose",
  "inputs",
  "outputs",
  "dry-run or preview behavior",
  "exit code behavior",
];

function listTrackedScriptPaths() {
  return execFileSync("git", ["ls-files", "scripts", "src/scripts"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function listTrackedPythonScriptPaths() {
  return listTrackedScriptPaths().filter((script) => script.endsWith(".py"));
}

function parseScriptRows() {
  assert.ok(existsSync(SCRIPT_DOC_PATH), `${SCRIPT_DOC_PATH} must exist`);
  const source = readFileSync(SCRIPT_DOC_PATH, "utf8");
  const rows = new Map<string, Record<(typeof REQUIRED_COLUMNS)[number], string>>();

  for (const line of source.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    assert.equal(cells.length, REQUIRED_COLUMNS.length, `script maintenance row has wrong cell count: ${line}`);

    const script = cells[0].replace(/^`|`$/g, "");
    rows.set(
      script,
      Object.fromEntries(REQUIRED_COLUMNS.map((column, index) => [column, cells[index]])) as Record<
        (typeof REQUIRED_COLUMNS)[number],
        string
      >,
    );
  }

  return rows;
}

test("script maintenance doc records repeatable behavior for every tracked script", () => {
  const rows = parseScriptRows();
  const expectedScripts = listTrackedScriptPaths();

  assert.deepEqual(
    expectedScripts.filter((script) => !rows.has(script)),
    [],
    `${SCRIPT_DOC_PATH} must include every tracked script file`,
  );
  assert.deepEqual(
    [...rows.keys()].filter((script) => !expectedScripts.includes(script)),
    [],
    `${SCRIPT_DOC_PATH} must not include untracked script rows`,
  );

  for (const [script, row] of rows) {
    for (const column of REQUIRED_COLUMNS) {
      assert.notEqual(row[column], "", `${script} is missing ${column}`);
      assert.doesNotMatch(row[column], /\b(?:TBD|TODO)\b/i, `${script} ${column} must be resolved`);
    }
    assert.match(row["dry-run or preview behavior"], /dry-run|preview|help|not supported|read-only|no direct/i);
    assert.match(row["exit code behavior"], /0|non-zero|exit/i);
  }
});

test("documentation index points agents to the script maintenance matrix", () => {
  assert.ok(existsSync(DOC_INDEX_PATH), `${DOC_INDEX_PATH} must exist`);
  const index = readFileSync(DOC_INDEX_PATH, "utf8");
  assert.match(index, /script maintenance/i);
  assert.match(index, /docs\/script-maintenance\.md/);
});

test("script maintenance doc records Python script environment boundaries", () => {
  assert.ok(existsSync(SCRIPT_DOC_PATH), `${SCRIPT_DOC_PATH} must exist`);
  const source = readFileSync(SCRIPT_DOC_PATH, "utf8");

  assert.match(source, /## Python Environments/);
  assert.match(source, /python3/);
  assert.match(source, /AUTO_CENSOR_PYTHON_CMD/);
  assert.match(source, /ultralytics/);
  assert.match(source, /opencv-python/);
  assert.match(source, /pillow/);
  assert.match(source, /standard library only/i);

  for (const script of listTrackedPythonScriptPaths()) {
    assert.match(source, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${script} must be named in the Python environment section`);
  }
});
