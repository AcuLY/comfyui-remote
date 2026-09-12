import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const QUALITY_CLI_SCRIPTS = [
  "scripts/quality/baseline.ts",
  "scripts/quality/evaluate.ts",
  "scripts/quality/review.ts",
] as const;

const QUALITY_SERVER_FILES = [
  "src/server/quality/phase0-baseline.ts",
  "src/server/quality/phase1-offline-eval.ts",
] as const;
const QUALITY_REPORT_DIR = "reports/quality/auto-review-analysis";
const QUALITY_FIXTURE =
  "tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json";
const QUALITY_ANALYSIS_DOC = "docs/testing/quality-analysis.md";

test("quality report CSV serialization stays centralized in shared csv-utils", () => {
  const csvUtilsSource = readFileSync("src/server/quality/csv-utils.ts", "utf8");
  assert.match(csvUtilsSource, /export function serializeCsv/);
  assert.match(csvUtilsSource, /export function csvCell/);
  assert.match(csvUtilsSource, /export function spreadsheetSafeText/);

  for (const filePath of QUALITY_SERVER_FILES) {
    const source = readFileSync(filePath, "utf8");
    assert.match(source, /from "\.\/csv-utils"/, `${filePath} must import shared CSV utilities`);
    assert.doesNotMatch(
      source,
      /function\s+(?:serializeCsv|csvCell|spreadsheetSafeText)\b/,
      `${filePath} must not reimplement shared CSV serialization`,
    );
  }
});

test("quality CLI scripts expose typed result builders for their JSON output", () => {
  for (const filePath of QUALITY_CLI_SCRIPTS) {
    const source = readFileSync(filePath, "utf8");
    const resultName = filePath.includes("baseline")
      ? "BaselineCliResult"
      : filePath.includes("evaluate")
        ? "EvaluateCliResult"
        : "ReviewCliResult";
    const builderName = filePath.includes("baseline")
      ? "buildBaselineCliResult"
      : filePath.includes("evaluate")
        ? "buildEvaluateCliResult"
        : "buildReviewCliResult";

    assert.match(
      source,
      new RegExp(`export interface ${resultName} \\{`),
      `${filePath} must export a typed CLI result object`,
    );
    assert.match(
      source,
      new RegExp(`export function ${builderName}\\(`),
      `${filePath} must build CLI JSON through a named typed result helper`,
    );
    assert.match(
      source,
      new RegExp(`const result = ${builderName}\\(`),
      `${filePath} run function must serialize the typed result helper output`,
    );
  }
});

test("quality analysis reports and fixture have explicit owners", () => {
  const readme = readFileSync(QUALITY_ANALYSIS_DOC, "utf8");
  const documentedFiles = new Map<string, string[]>();

  for (const line of readme.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    documentedFiles.set(cells[0].replace(/^`|`$/g, ""), cells);
  }

  const trackedDataFiles = execFileSync(
    "git",
    ["ls-files", QUALITY_REPORT_DIR, QUALITY_FIXTURE],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((filePath) => /\.(?:csv|json|md)$/i.test(filePath))
    .sort((left, right) => left.localeCompare(right));

  assert.notEqual(trackedDataFiles.length, 0, "quality analysis data fixture list must not be empty");
  assert.deepEqual(
    trackedDataFiles.filter((filePath) => !documentedFiles.has(filePath)),
    [],
    `${QUALITY_ANALYSIS_DOC} must document every tracked quality analysis data file`,
  );

  for (const filePath of trackedDataFiles) {
    const cells = documentedFiles.get(filePath) ?? [];
    assert.match(cells[1] ?? "", /quality-analysis/i, `${filePath} must name an owner`);
    assert.ok((cells[2] ?? "").trim(), `${filePath} must have a non-empty classification`);
    assert.match(
      cells[3] ?? "",
      /quality:(?:baseline|evaluate|verify|review)/,
      `${filePath} must document its regeneration or verification command owner`,
    );
  }
});
