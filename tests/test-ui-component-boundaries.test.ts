import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const boundaryDocPath = "docs/ui/component-boundaries.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function sourceFilesUnder(path: string): string[] {
  const absolutePath = join(repoRoot, path);
  if (!existsSync(absolutePath)) return [];

  return readdirSync(absolutePath).flatMap((entry) => {
    const childPath = join(path, entry);
    const childAbsolutePath = join(repoRoot, childPath);
    const stat = statSync(childAbsolutePath);
    if (stat.isDirectory()) return sourceFilesUnder(childPath);
    return /\.(tsx?|jsx?)$/.test(entry) ? [childPath] : [];
  });
}

test("UI component boundary doc classifies shadcn and design-demo primitives", () => {
  assert.ok(existsSync(join(repoRoot, boundaryDocPath)), `${boundaryDocPath} should document UI component ownership`);

  const boundaryDoc = readSource(boundaryDocPath);
  const docsIndex = readSource("docs/index.md");

  for (const primitive of ["button", "input", "select", "separator", "sheet", "sidebar", "skeleton", "tooltip"]) {
    assert.match(
      boundaryDoc,
      new RegExp(`src/components/ui/${primitive}\\.tsx[\\s\\S]*production-supported shadcn local copy`),
      `${primitive} primitive should have an explicit supported shadcn-local status`,
    );
  }

  assert.match(boundaryDoc, /src\/components\/design-demo-ui\//, "design-demo UI namespace should be documented");
  assert.match(boundaryDoc, /not the default production primitive layer/, "design-demo primitives should not be documented as production defaults");
  assert.match(boundaryDoc, /src\/components\/section-sidebar-nav\.tsx/, "sidebar wrapper owner should be documented");
  assert.match(docsIndex, /docs\/ui\/component-boundaries\.md/, "documentation index should point agents to the UI boundary doc");
});

test("training shell does not import the shadcn sidebar primitive directly", () => {
  const trainingFiles = [
    ...sourceFilesUnder("src/features/training"),
    ...sourceFilesUnder("src/app/training"),
  ];
  const directSidebarImports = trainingFiles.filter((path) =>
    readSource(path).includes("@/components/ui/sidebar"),
  );

  assert.deepEqual(directSidebarImports, [], "training shell files should not directly import components/ui/sidebar");
});
