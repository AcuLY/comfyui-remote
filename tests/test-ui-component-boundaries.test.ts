import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const boundaryDocPath = "docs/design/component-patterns.md";

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
  const designRouter = readSource("docs/design/README.md");

  for (const primitive of ["button", "input", "select", "separator", "sheet", "sidebar", "skeleton", "tooltip"]) {
    assert.match(
      boundaryDoc,
      new RegExp(`src/components/ui/\\*\\*[\\s\\S]*${primitive}`),
      `${primitive} should remain listed under the production primitive owner`,
    );
  }

  assert.match(boundaryDoc, /src\/components\/design-demo-ui\/\*\*/, "design-demo UI namespace should be documented");
  assert.match(boundaryDoc, /不是无关 Generation 生产基础组件的默认命名空间/, "design-demo primitives should not be documented as production defaults");
  assert.match(boundaryDoc, /src\/components\/\*\*[\s\S]*跨功能生产包装器/, "cross-feature production wrappers should have an owner");
  assert.match(boundaryDoc, /Training 外壳可以复用[\s\S]*不能让 design-demo 路由或固件成为生产依赖/, "Training reuse should preserve the production/demo boundary");
  assert.match(designRouter, /\[组件模式\]\(component-patterns\.md\)/, "the current design router should point agents to the component owner");
});

test("responsive owner records the current 42px drawer gap without weakening the 44px target", () => {
  const responsiveDoc = readSource("docs/design/responsive-and-accessibility.md");
  const shellCss = readSource("src/components/design-demo-shell/app-shell.module.css");

  assert.match(
    shellCss,
    /\.mobileTopbarButton\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-height:\s*44px;/,
    "current top-bar controls should retain their documented 44px target",
  );
  assert.match(
    shellCss,
    /\.mobileNavDrawerButton\s*\{[\s\S]*?width:\s*42px;[\s\S]*?height:\s*42px;/,
    "the current drawer implementation should remain recorded as 42x42px",
  );
  assert.match(responsiveDoc, /mobileNavDrawerButton` 为 42×42px/, "the design owner must disclose the current drawer size");
  assert.match(responsiveDoc, /目标下限应为 44×44px/, "the design owner must keep the intended touch target explicit");
  assert.match(responsiveDoc, /不得把当前实现描述为已经达标/, "the known gap must not be reported as complete");
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
