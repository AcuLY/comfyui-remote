import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const governanceDocPath = "docs/design/design-demo-governance.md";

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

test("design-demo governance doc classifies the app and source-of-truth boundaries", () => {
  assert.ok(existsSync(join(repoRoot, governanceDocPath)), `${governanceDocPath} should document design-demo ownership`);

  const doc = readSource(governanceDocPath);
  const designRouter = readSource("docs/design/README.md");

  assert.match(doc, /生效中的组件实验室和视觉验证界面/);
  assert.match(doc, /路由模式、匹配、工作模式导航和示例路由清单[\s\S]*src\/app\/design-demos\/routing\/routes\.ts/);
  assert.match(doc, /路由身份、返回链接、元数据和页头操作[\s\S]*src\/app\/design-demos\/routing\/header-specs\.ts/);
  assert.match(doc, /只读本地 SQLite 加载与回退选择[\s\S]*src\/app\/design-demos\/data\/load-demo-data\.ts/);
  assert.match(doc, /src\/app\/design-demos\/routing\/showcase-routes\.ts/);
  assert.match(doc, /src\/app\/design-demos\/showcase\/registry\.ts/);
  assert.match(doc, /src\/features\/training/);
  assert.match(doc, /刻意保持为生产 Training 界面的窄范围重新导出/);
  assert.match(doc, /不得在文档中维护人工复制的路由一致性表/);
  assert.match(doc, /刻意不声称完整 showcase-registry 测试套件已经全绿/);
  assert.match(designRouter, /\[设计演示治理\]\(design-demo-governance\.md\)/, "the current design router should point agents to design-demo governance");
});

test("design-demo source files still expose the documented governance entrypoints", () => {
  const routesSource = readSource("src/app/design-demos/routing/routes.ts");
  const headerSpecsSource = readSource("src/app/design-demos/routing/header-specs.ts");
  const dataLoaderSource = readSource("src/app/design-demos/data/load-demo-data.ts");
  const showcaseRoutesSource = readSource("src/app/design-demos/routing/showcase-routes.ts");
  const showcaseRegistrySource = readSource("src/app/design-demos/showcase/registry.ts");

  assert.match(routesSource, /export const ROUTES: RouteDef\[\]/, "route registry should remain explicit and importable");
  assert.match(routesSource, /export function buildWorkModeNavLinks/, "navigation should flow through the route registry");
  assert.match(headerSpecsSource, /import[\s\S]*ROUTES[\s\S]*from "\.\/"/, "header specs should consume the route registry");
  assert.match(headerSpecsSource, /export function buildHeaderSpecs/, "route headers should remain generated from header specs");
  assert.match(dataLoaderSource, /resolveSqlitePath\(\)/, "data loader should make the SQLite source explicit");
  assert.match(dataLoaderSource, /fallbackData\(/, "data loader should keep static fallback data explicit");
  assert.match(dataLoaderSource, /fallbackImages\(/, "data loader should keep local image fallback explicit");
  assert.match(dataLoaderSource, /sourceSummary\(/, "data loader should report source labels to the shell");
  assert.match(showcaseRoutesSource, /export const SHOWCASE_ROUTE_METADATA/, "showcase routes should remain an explicit registry");
  assert.match(showcaseRegistrySource, /export const SHOWCASE_FAMILIES/, "showcase families should remain owned by the registry");
  assert.match(showcaseRegistrySource, /export const SHOWCASE_COMPONENTS/, "showcase component entries should remain owned by the registry");
});

test("design-demo styling stays inside its current CSS-module ownership boundary", () => {
  const governanceDoc = readSource(governanceDocPath);
  const sources = sourceFilesUnder("src/app/design-demos");

  assert.match(governanceDoc, /功能自有的 CSS Module/);
  assert.match(governanceDoc, /不得通过修改 `src\/app\/globals\.css`/);
  assert.match(governanceDoc, /Tailwind、`tailwind-merge`、`class-variance-authority`/);
  assert.match(governanceDoc, /不得恢复源码旁的人工组件清单、迁移表或完成度表/);

  for (const path of sources) {
    const source = readSource(path);
    assert.doesNotMatch(source, /(?:tailwind-merge|class-variance-authority|\bcva\s*\()/, `${path} should not introduce Tailwind helper dependencies`);
    assert.doesNotMatch(source, /(?:@\/app\/globals\.css|src\/app\/globals\.css)/, `${path} should not import the application global stylesheet`);
  }
});

test("design-demo governance uses live registries instead of a legacy parity document", () => {
  const governanceDoc = readSource(governanceDocPath);
  const routesSource = readSource("src/app/design-demos/routing/routes.ts");
  const trainingRoutesSource = readSource("src/features/training/routes.ts");

  assert.match(governanceDoc, /针对这些注册表和生产路由所有者的测试能提供更新鲜的契约/);
  assert.match(routesSource, /export const ROUTES: RouteDef\[\]/);
  assert.match(trainingRoutesSource, /export const TRAINING_ROUTE_PATTERNS/);
  assert.doesNotMatch(governanceDoc, /docs\/design-demos-frontend-parity\.md/);
});

test("design-demo lora-training compatibility files keep shared production UI intentional", () => {
  const trainingDemoFiles = [
    ...sourceFilesUnder("src/app/design-demos/features/lora-training"),
    "src/app/design-demos/data/lora-training.ts",
  ];
  const productionTrainingImports = trainingDemoFiles.filter((path) => readSource(path).includes("@/features/training"));

  assert.ok(productionTrainingImports.length > 0, "design-demo training pages should document intentional shared production UI");
  for (const path of productionTrainingImports) {
    assert.match(
      readSource(path),
      /export \{[\s\S]*\} from "@\/features\/training\//,
      `${path} should keep production training reuse as a narrow re-export compatibility boundary`,
    );
  }
});
