import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const DOMAIN_BUILDERS_PATH = "tests/fixtures/domain-builders.ts";
const TEST_README_PATH = "tests/README.md";

const REQUIRED_DOMAIN_BUILDERS = [
  "buildProjectFixture",
  "buildProjectSectionFixture",
  "buildPresetCategoryFixture",
  "buildPresetFixture",
  "buildPresetGroupFixture",
  "buildTemplateFixture",
  "buildRunFixture",
  "buildImageResultFixture",
  "buildTrainingProjectFixture",
  "buildTrainingSectionFixture",
  "buildTrainingGenerationTaskFixture",
  "buildTrainingDatasetRevisionFixture",
  "buildTrainingRunFixture",
] as const;

function listTrackedTestFiles(): string[] {
  return execFileSync("git", ["ls-files", "tests", "src/app/design-demos"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((filePath) => filePath.endsWith(".test.ts"))
    .sort((left, right) => left.localeCompare(right));
}

test("shared domain fixture builders cover roadmap resource types", async () => {
  assert.ok(existsSync(DOMAIN_BUILDERS_PATH), `${DOMAIN_BUILDERS_PATH} must exist`);
  const source = readFileSync(DOMAIN_BUILDERS_PATH, "utf8");

  for (const builderName of REQUIRED_DOMAIN_BUILDERS) {
    assert.match(
      source,
      new RegExp(`export function ${builderName}\\(`),
      `${DOMAIN_BUILDERS_PATH} must export ${builderName}`,
    );
  }

  const builders = (await import("./fixtures/domain-builders")) as Record<
    (typeof REQUIRED_DOMAIN_BUILDERS)[number],
    (overrides?: Record<string, unknown>) => Record<string, unknown>
  >;
  const project = builders.buildProjectFixture({ id: "project-custom" });
  const section = builders.buildProjectSectionFixture({ projectId: project.id });
  const run = builders.buildRunFixture({ projectId: project.id, projectSectionId: section.id });
  const image = builders.buildImageResultFixture({ runId: run.id });
  const trainingProject = builders.buildTrainingProjectFixture({ id: "training-project-custom" });
  const trainingSection = builders.buildTrainingSectionFixture({ projectId: trainingProject.id });
  const generationTask = builders.buildTrainingGenerationTaskFixture({
    projectId: trainingProject.id,
    sectionId: trainingSection.id,
  });
  const datasetRevision = builders.buildTrainingDatasetRevisionFixture({
    projectId: trainingProject.id,
  });
  const trainingRun = builders.buildTrainingRunFixture({
    projectId: trainingProject.id,
    datasetRevisionId: datasetRevision.id,
  });

  assert.equal(section.projectId, project.id);
  assert.equal(run.projectSectionId, section.id);
  assert.equal(image.runId, run.id);
  assert.equal(generationTask.sectionId, trainingSection.id);
  assert.equal(trainingRun.datasetRevisionId, datasetRevision.id);
});

test("test README documents fixture, native-module, source-contract, and route-env rules", () => {
  assert.ok(existsSync(TEST_README_PATH), `${TEST_README_PATH} must exist`);
  const readme = readFileSync(TEST_README_PATH, "utf8");

  assert.match(readme, /tests\/fixtures\/domain-builders\.ts/);
  assert.match(readme, /tests\/fixtures\/sqlite-db\.ts/);
  assert.match(readme, /regenerated native modules/i);
  assert.match(readme, /local DB files/i);
  assert.match(readme, /source contract/i);
  assert.match(readme, /route modules only after test env vars are set/i);
  assert.match(readme, /fresh DB\/file fixtures/i);
});

test("route tests import route modules dynamically after environment setup", () => {
  for (const filePath of listTrackedTestFiles()) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /^\s*import\s+.+from\s+["'][^"']*src\/app\/api\//m,
      `${filePath} must not statically import route modules before env setup`,
    );
  }
});

test("better-sqlite3 direct setup stays behind the shared sqlite fixture", () => {
  const directBetterSqliteImports = execFileSync("rg", ["-l", "better-sqlite3", "tests"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((filePath) => filePath !== "tests/fixtures/sqlite-db.ts")
    .filter((filePath) => filePath !== "tests/test-fixture-governance.test.ts")
    .filter((filePath) => filePath !== "tests/README.md");

  assert.deepEqual(directBetterSqliteImports, []);
});
