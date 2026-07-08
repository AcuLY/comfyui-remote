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

test("dialog and cascade pickers keep labeled modal surfaces and portal owners", () => {
  const pickerExpectations = [
    {
      file: "src/components/lora-cascade-picker.tsx",
      label: /aria-label=\{`\$\{label\} 选择器`\}/,
      searchLabel: /aria-label=\{`搜索 \$\{label\} 文件`\}/,
    },
    {
      file: "src/components/preset-cascade-picker.tsx",
      label: /aria-label="选择预制"/,
      searchLabel: /aria-label="搜索预制"/,
    },
    {
      file: "src/components/preset-group-cascade-picker.tsx",
      label: /aria-label="选择预制组"/,
      searchLabel: /aria-label="搜索预制组"/,
    },
    {
      file: "src/components/project-cascade-picker.tsx",
      label: /aria-label="选择项目"/,
      searchLabel: /aria-label="搜索项目"/,
    },
    {
      file: "src/components/preset-section-replacement-dialog.tsx",
      label: /aria-label="批量替换预制"/,
      searchLabel: /aria-label="关闭"/,
    },
  ];

  for (const expectation of pickerExpectations) {
    const source = readSource(expectation.file);
    assert.match(source, /createPortal\(/, `${expectation.file} should render modal content through a portal`);
    assert.match(source, /role="dialog"/, `${expectation.file} should expose a dialog role`);
    assert.match(source, /aria-modal="true"/, `${expectation.file} should mark modal content as modal`);
    assert.match(source, expectation.label, `${expectation.file} should label the dialog surface`);
    assert.match(source, expectation.searchLabel, `${expectation.file} should label key dialog controls`);
  }

  const checkpointSource = readSource("src/components/checkpoint-cascade-picker.tsx");
  assert.match(checkpointSource, /<LoraCascadePicker[\s\S]*kind="checkpoint"/, "checkpoint picker should inherit the model cascade dialog boundary");
});

test("copy buttons and toast text behavior stay under regression tests", () => {
  const notificationCopyTest = readSource("tests/test-notification-copy-button.test.ts");
  const appShell = readSource("src/components/app-shell.tsx");

  assert.match(notificationCopyTest, /app shell mounts the notification copy button enhancement/, "notification copy mounting should have a regression test");
  assert.match(notificationCopyTest, /querySelectorAll/, "notification copy tests should cover Sonner toast discovery");
  assert.match(notificationCopyTest, /cloneNode/, "notification copy tests should protect copied toast text extraction");
  assert.match(notificationCopyTest, /navigator/, "notification copy tests should protect Clipboard API usage");
  assert.match(notificationCopyTest, /execCommand/, "notification copy tests should protect the fallback copy path");
  assert.match(notificationCopyTest, /copy button needs an accessible label/, "copy-button accessibility labels should be tested");
  assert.match(appShell, /toast: "!pr-20"/, "toast layout should reserve room for copy and close controls");
});
