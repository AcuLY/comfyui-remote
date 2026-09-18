import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { load } from "js-yaml";

const repoRoot = process.cwd();
const verifierPath = "tests/test-product-design-doc-governance.test.ts";

type DocumentMetadata = {
  schemaVersion: number;
  document: {
    type: string;
    owner: string;
    authority: {
      subject: string;
      kind: string;
    };
    sources: string[];
    verifiedBy: string[];
  };
};

const expectations = [
  ["PRODUCT.md", "product", "product", "product-direction", "canonical", "# 产品"],
  ["docs/product/README.md", "router", "product", "product-documentation", "router", "# 产品文档"],
  ["docs/product/generation/README.md", "router", "product-generation", "generation-product", "router", "# Generation 产品"],
  ["docs/product/generation/project-archive.md", "product", "product-generation", "generation-project-archive", "reference", "# 项目导出与归档"],
  ["docs/product/generation/preset-section-replacement.md", "product", "product-generation", "generation-preset-section-replacement", "reference", "# 小节预制批量替换"],
  ["docs/product/training/README.md", "router", "product-training", "training-product", "router", "# Training 产品"],
  ["docs/product/shared-resources/README.md", "router", "product-shared-resources", "shared-resource-product", "router", "# 共享资源"],
  ["docs/product/shared-resources/position-presets.md", "product", "product-prompt-reference", "position-preset-catalog", "reference", "# 体位预制"],
  ["DESIGN.md", "design", "product-design", "product-design-direction", "canonical", "# 设计"],
  ["docs/design/README.md", "router", "product-design", "product-design-documentation", "router", "# 设计文档"],
  ["docs/design/layout-and-density.md", "design", "product-design", "layout-and-density", "reference", "# 布局与密度"],
  ["docs/design/component-patterns.md", "design", "product-design", "ui-component-ownership", "reference", "# 组件模式"],
  ["docs/design/interaction-and-motion.md", "design", "product-design", "interaction-and-motion", "reference", "# 交互与动效"],
  ["docs/design/responsive-and-accessibility.md", "design", "product-design", "responsive-accessibility", "reference", "# 响应式设计与无障碍"],
  ["docs/design/review-workbench.md", "design", "product-design", "image-review-workbench", "reference", "# 审核工作台"],
  ["docs/design/design-demo-governance.md", "design", "product-design", "design-demo-governance", "reference", "# Design-demo 治理"],
] as const;

function readDocument(path: string) {
  const source = readFileSync(resolve(repoRoot, path), "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, `${path} should have YAML frontmatter`);
  return {
    source,
    metadata: load(match[1]) as DocumentMetadata,
  };
}

for (const [path, type, owner, subject, authorityKind, heading] of expectations) {
  test(`${path} publishes its current owner and executable verifier`, () => {
    const { source, metadata } = readDocument(path);
    const document = metadata.document;

    assert.equal(metadata.schemaVersion, 1);
    assert.equal(document.type, type);
    assert.equal(document.owner, owner);
    assert.equal(document.authority.subject, subject);
    assert.equal(document.authority.kind, authorityKind);
    assert.match(source, new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
    assert.ok(document.sources.length > 0, `${path} should name its evidence sources`);
    assert.ok(
      document.verifiedBy.some((command) => command.includes(verifierPath)),
      `${path} should invoke the verifier that checks its new owner`,
    );

    for (const sourcePath of document.sources) {
      assert.ok(existsSync(resolve(repoRoot, sourcePath)), `${path} source should exist: ${sourcePath}`);
      assert.notEqual(sourcePath, path, `${path} should not cite itself as implementation evidence`);
    }
  });
}

test("product and design routers expose every current child owner", () => {
  const product = readDocument("PRODUCT.md").source;
  const productRouter = readDocument("docs/product/README.md").source;
  const design = readDocument("DESIGN.md").source;
  const designRouter = readDocument("docs/design/README.md").source;

  for (const path of [
    "docs/product/generation/README.md",
    "docs/product/training/README.md",
    "docs/product/shared-resources/README.md",
  ]) {
    assert.ok(product.includes(path), `PRODUCT.md should route to ${path}`);
  }
  for (const relativePath of ["generation/README.md", "training/README.md", "shared-resources/README.md"]) {
    assert.ok(productRouter.includes(relativePath), `product router should route to ${relativePath}`);
  }

  const generationRouter = readDocument("docs/product/generation/README.md").source;
  for (const relativePath of ["project-archive.md", "preset-section-replacement.md"]) {
    assert.ok(generationRouter.includes(relativePath), `Generation router should route to ${relativePath}`);
  }

  for (const path of [
    "docs/design/layout-and-density.md",
    "docs/design/component-patterns.md",
    "docs/design/interaction-and-motion.md",
    "docs/design/responsive-and-accessibility.md",
    "docs/design/review-workbench.md",
    "docs/design/design-demo-governance.md",
  ]) {
    assert.ok(design.includes(path), `DESIGN.md should route to ${path}`);
    assert.ok(designRouter.includes(path.replace("docs/design/", "")), `design router should route to ${path}`);
  }
});

test("Generation lifecycle details preserve destructive and verification boundaries", () => {
  const archive = readDocument("docs/product/generation/project-archive.md").source;
  assert.match(archive, /状态是 `done` 或 `partial_done`/);
  assert.match(archive, /删除完整顶层目录/);
  assert.match(archive, /文件清理不是数据库事务/);
  assert.match(archive, /没有再次调用 `isPathInsideDirectory` 做路径包含关系校验/);
  assert.match(archive, /当前 `ProjectArchiveButton` 丢弃该返回值/);
  assert.match(archive, /普通界面无法区分完整清理与部分清理/);
  assert.match(archive, /“已归档 · 文件已清理”/);
  assert.match(archive, /只是当前乐观界面状态，不是全部文件已删除的证据/);
  assert.match(archive, /不能把“已归档”解释成所有文件均已删除/);

  const replacement = readDocument("docs/product/generation/preset-section-replacement.md").source;
  assert.match(replacement, /预制组绑定不属于本流程/);
  assert.match(replacement, /省略时默认预演/);
  assert.match(replacement, /重新加载目标并再次生成同一组规则的计划/);
  assert.match(replacement, /不会把已经独立保存的 `LoRA` 编辑重新附着到新预制/);
});

test("design interaction owner preserves the design-demo return-position contract", () => {
  const interaction = readDocument("docs/design/interaction-and-motion.md").source;
  assert.match(interaction, /路由专用的 `sessionStorage` 键/);
  assert.match(interaction, /只读取一次并立即清除/);
  assert.match(interaction, /`scroll=\{false\}`/);
  assert.match(interaction, /文档不维护易漂移的路由矩阵/);
});
