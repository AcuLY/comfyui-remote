import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const TSX = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const GENERATOR = join(ROOT, "scripts", "docs", "generate-repo-inventory.ts");

type InventoryRow = {
  path: string;
  area: string;
  owner: string;
  fileType: string;
  classification: string;
  classificationSource: string;
};

function git(root: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function runGenerator(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [TSX, GENERATOR, ...args], { cwd: root, encoding: "utf8" });
}

function codeValue(value: string): string {
  return value.replace(/^`|`$/g, "");
}

function parseRows(source: string): Map<string, InventoryRow> {
  assert.match(source, /^\| 路径 \| 顶层区域 \| 责任方 \| 文件类型 \| 分类 \| 分类依据 \|$/m);
  const rows = new Map<string, InventoryRow>();
  for (const line of source.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 6, `清单行列数错误：${line}`);
    const row: InventoryRow = {
      path: codeValue(cells[0]),
      area: codeValue(cells[1]),
      owner: codeValue(cells[2]),
      fileType: cells[3],
      classification: codeValue(cells[4]),
      classificationSource: cells[5],
    };
    assert.ok(!rows.has(row.path), `${row.path} 在清单中重复出现`);
    rows.set(row.path, row);
  }
  return rows;
}

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "repo-inventory-metadata-"));
  await mkdir(join(root, "docs", "_meta"), { recursive: true });
  await mkdir(join(root, "docs", "architecture"), { recursive: true });
  await mkdir(join(root, "openspec"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  await cp(join(ROOT, "docs", "_meta", "policy.yaml"), join(root, "docs", "_meta", "policy.yaml"));
  await cp(
    join(ROOT, "docs", "_meta", "documentation.schema.json"),
    join(root, "docs", "_meta", "documentation.schema.json"),
  );
  await writeFile(join(root, "README.md"), `---
schemaVersion: 1
document:
  type: router
  status: current
  owner: fixture-root
  authority:
    subject: fixture-root
    kind: router
  readWhen:
    - 验证仓库清单时
  sources:
    - docs/architecture/training-preset.md
  verifiedBy:
    - node --test
---

# 临时仓库
`);
  await writeFile(join(root, "docs", "architecture", "training-preset.md"), `---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: first-owner
  authority:
    subject: fixture-architecture
    kind: reference
  readWhen:
    - 验证元数据推导时
  sources:
    - src/training-preset-worker.ts
  verifiedBy:
    - node --test
---

# 临时架构文档
`);
  await writeFile(join(root, "openspec", "training-preset.md"), "# 生命周期材料\n");
  await writeFile(join(root, "src", "training-preset-worker.ts"), "export const value = 1;\n");
  await writeFile(join(root, "src", "preset-training-helper.ts"), "export const value = 2;\n");

  git(root, "init", "--quiet");
  git(root, "config", "user.name", "Inventory Test");
  git(root, "config", "user.email", "inventory@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "fixture");
  return root;
}

test("仓库清单的语义分类只来自文档元数据或治理 policy", async () => {
  const root = await createFixture();
  try {
    const firstRun = runGenerator(root);
    assert.equal(firstRun.status, 0, firstRun.stderr);
    const outputPath = join(root, "docs", "repo-inventory.md");
    const firstOutput = await readFile(outputPath, "utf8");
    const firstRows = parseRows(firstOutput);

    assert.deepEqual(firstRows.get("docs/architecture/training-preset.md"), {
      path: "docs/architecture/training-preset.md",
      area: "docs",
      owner: "first-owner",
      fileType: "`Markdown` 文档",
      classification: "architecture",
      classificationSource: "文档元数据",
    });
    assert.equal(firstRows.get("openspec/training-preset.md")?.owner, "repository-maintainers");
    assert.equal(firstRows.get("openspec/training-preset.md")?.classification, "openspec");
    assert.equal(firstRows.get("openspec/training-preset.md")?.classificationSource, "治理策略");

    for (const path of ["src/training-preset-worker.ts", "src/preset-training-helper.ts"]) {
      assert.equal(firstRows.get(path)?.owner, "repository-maintainers", `${path} 不得从文件名猜测 owner`);
      assert.equal(firstRows.get(path)?.classification, "仓库文件", `${path} 应使用诚实的通用分类`);
      assert.equal(firstRows.get(path)?.classificationSource, "通用回退");
    }

    const documentPath = join(root, "docs", "architecture", "training-preset.md");
    const document = await readFile(documentPath, "utf8");
    await writeFile(documentPath, document.replace("owner: first-owner", "owner: second-owner"));
    const metadataRun = runGenerator(root);
    assert.equal(metadataRun.status, 0, metadataRun.stderr);
    const metadataOutput = await readFile(outputPath, "utf8");
    assert.notEqual(metadataOutput, firstOutput);
    assert.equal(parseRows(metadataOutput).get("docs/architecture/training-preset.md")?.owner, "second-owner");

    const policyPath = join(root, "docs", "_meta", "policy.yaml");
    const policy = await readFile(policyPath, "utf8");
    const changedPolicy = policy.replace(
      /(\n  - id: openspec-lifecycle[\s\S]*?\n    kind: )openspec(\n)/,
      "$1lifecycle-fixture$2",
    );
    assert.notEqual(changedPolicy, policy, "测试必须实际修改 openspec-lifecycle 的 scope.kind");
    await writeFile(policyPath, changedPolicy);
    const policyRun = runGenerator(root);
    assert.equal(policyRun.status, 0, policyRun.stderr);
    const policyRows = parseRows(await readFile(outputPath, "utf8"));
    assert.equal(policyRows.get("openspec/training-preset.md")?.classification, "lifecycle-fixture");
    assert.equal(policyRows.get("openspec/training-preset.md")?.classificationSource, "治理策略");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
