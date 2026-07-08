import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const prototypeReadmePath = "docs/prototypes/README.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceFilesUnder(path: string): string[] {
  const absolutePath = join(repoRoot, path);
  if (!existsSync(absolutePath)) return [];

  return readdirSync(absolutePath).flatMap((entry) => {
    const childPath = [path, entry].join("/");
    const childAbsolutePath = join(repoRoot, childPath);
    const stat = statSync(childAbsolutePath);
    if (stat.isDirectory()) return sourceFilesUnder(childPath);
    return [childPath];
  });
}

const prototypeRouteMap = new Map([
  ["docs/prototypes/manager-lora-training-runs-prototype.html", "/training/runs"],
  ["docs/prototypes/manager-lora-training-generation-detail-prototype.html", "/training/runs/generation/:taskId"],
  ["docs/prototypes/manager-lora-training-training-detail-prototype.html", "/training/runs/training/:trainingRunId"],
  ["docs/prototypes/manager-lora-training-projects-prototype.html", "/training/projects"],
  ["docs/prototypes/manager-lora-training-project-new-prototype.html", "/training/projects/new"],
  ["docs/prototypes/manager-lora-training-project-detail-prototype.html", "/training/projects/:trainingProjectId"],
  ["docs/prototypes/manager-lora-training-project-profile-prototype.html", "/training/projects/:trainingProjectId/profile"],
  ["docs/prototypes/manager-lora-training-project-sections-prototype.html", "/training/projects/:trainingProjectId/sections"],
  ["docs/prototypes/manager-lora-training-project-section-detail-prototype.html", "/training/projects/:trainingProjectId/sections/:sectionId"],
  [
    "docs/prototypes/manager-lora-training-generation-compose-prototype.html",
    "/training/projects/:trainingProjectId/sections/:sectionId/generation-tasks/new",
  ],
  ["docs/prototypes/manager-lora-training-project-results-prototype.html", "/training/projects/:trainingProjectId/results"],
  ["docs/prototypes/manager-lora-training-project-dataset-prototype.html", "/training/projects/:trainingProjectId/dataset"],
  [
    "docs/prototypes/manager-lora-training-project-dataset-revision-prototype.html",
    "/training/projects/:trainingProjectId/dataset/revisions/:revisionId",
  ],
  ["docs/prototypes/manager-lora-training-project-training-runs-prototype.html", "/training/projects/:trainingProjectId/training-runs"],
  ["docs/prototypes/manager-lora-training-project-generation-tasks-prototype.html", "/training/projects/:trainingProjectId/generation-tasks"],
  ["docs/prototypes/manager-lora-training-presets-prototype.html", "/training/presets"],
  ["docs/prototypes/manager-lora-training-preset-detail-prototype.html", "/training/presets/:presetId"],
  ["docs/prototypes/manager-lora-training-preset-sort-rules-prototype.html", "/training/presets/sort-rules"],
  ["docs/prototypes/manager-lora-training-templates-prototype.html", "/training/templates"],
  ["docs/prototypes/manager-lora-training-template-new-prototype.html", "/training/templates/new"],
  ["docs/prototypes/manager-lora-training-template-edit-prototype.html", "/training/templates/:templateId/edit"],
  ["docs/prototypes/manager-lora-training-template-section-prototype.html", "/training/templates/:templateId/sections/:sectionIndex"],
]);

test("training prototype README maps every HTML prototype to a production training route", () => {
  assert.ok(existsSync(join(repoRoot, prototypeReadmePath)), `${prototypeReadmePath} should classify training prototypes`);

  const doc = readSource(prototypeReadmePath);
  const docsIndex = readSource("docs/index.md");
  const actualPrototypeFiles = sourceFilesUnder("docs/prototypes")
    .filter((path) => /^docs\/prototypes\/manager-lora-training-.*\.html$/.test(path))
    .sort();

  assert.deepEqual(actualPrototypeFiles, [...prototypeRouteMap.keys()].sort(), "every training HTML prototype should be listed in the route map");
  assert.match(doc, /source-of-truth only for training prototype intent, not production route behavior/);
  assert.match(doc, /\| prototype file \| production training route \| intent status \| production owner \|/);
  assert.match(docsIndex, /docs\/prototypes\/README\.md/);

  for (const [file, route] of prototypeRouteMap) {
    assert.match(
      doc,
      new RegExp(`\\| \`${escapeRegExp(file)}\` \\| \`${escapeRegExp(route)}\` \\| prototype intent \\| \`src/features/training\` \\|`),
      `${file} should map to ${route}`,
    );
  }
});

test("training prototype shared assets remain prototype-only", () => {
  const doc = readSource(prototypeReadmePath);
  assert.match(doc, /prototype-only shared assets/);
  assert.match(doc, /docs\/prototypes\/assets\/lora-training-shared\.css/);
  assert.match(doc, /docs\/prototypes\/assets\/lora-training-shared\.js/);
  assert.match(doc, /Do not import these assets from production CSS or src\/\*\*/);

  for (const file of prototypeRouteMap.keys()) {
    const source = readSource(file);
    assert.match(source, /assets\/lora-training-shared\.css/, `${file} should use the shared prototype CSS`);
    assert.match(source, /assets\/lora-training-shared\.js/, `${file} should use the shared prototype JS`);
  }

  const productionReferences = sourceFilesUnder("src").filter((path) => {
    const source = readSource(path);
    return source.includes("lora-training-shared.css") || source.includes("lora-training-shared.js") || source.includes("docs/prototypes/assets");
  });
  assert.deepEqual(productionReferences, [], "production source must not import prototype-only assets");
});
