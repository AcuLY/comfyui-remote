import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";

import {
  assertPolicySchemaProfiles,
  loadMetadataValidator,
  loadPolicy,
} from "./check/config";
import { parseMarkdownDocument } from "./check/markdown";
import type { GovernancePolicy, ScopeRule } from "./check/model";
import { matchesRule } from "./check/path";

const INVENTORY_PATH = "docs/repo-inventory.md";
const GENERIC_OWNER = "repository-maintainers";

type InventoryRow = {
  path: string;
  area: string;
  owner: string;
  fileType: string;
  classification: string;
  classificationSource: "文档元数据" | "治理策略" | "通用回退";
};

type MetadataRecord = Record<string, unknown>;

function record(value: unknown, label: string): MetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是映射。`);
  }
  return value as MetadataRecord;
}

function gitTrackedFiles(root: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function resolveScope(path: string, policy: GovernancePolicy): ScopeRule | null {
  const matches = policy.scope.filter((scope) => matchesRule(path, scope.include, scope.exclude));
  if (matches.length > 1) {
    throw new Error(`${path} 同时匹配多个 scope：${matches.map(({ id }) => id).join(", ")}`);
  }
  return matches[0] ?? null;
}

function getArea(path: string): string {
  return path.includes("/") ? path.slice(0, path.indexOf("/")) : "root";
}

function getFileType(path: string): string {
  const lower = path.toLowerCase();
  const extension = extname(lower);

  if (lower.endsWith(".test.ts") || lower.endsWith(".test.tsx") || lower.endsWith(".test.mjs") || lower.endsWith(".spec.ts")) {
    return "测试代码";
  }
  if (extension === ".md" || extension === ".mdx") return "`Markdown` 文档";
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".py", ".go", ".rs"].includes(extension)) {
    return "源码";
  }
  if ([".json", ".jsonl", ".yaml", ".yml", ".toml", ".csv"].includes(extension)) return "结构化数据";
  if (extension === ".prisma") return "`Prisma` 结构";
  if (extension === ".sql") return "`SQL` 文件";
  if ([".ps1", ".sh", ".bat", ".cmd"].includes(extension)) return "脚本";
  if ([".css", ".scss", ".sass", ".less"].includes(extension)) return "样式";
  if ([".html", ".htm"].includes(extension)) return "网页资产";
  if ([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico"].includes(extension)) return "图像资产";
  if ([".woff", ".woff2", ".ttf", ".otf"].includes(extension)) return "字体资产";
  return "仓库文件";
}

function documentIdentity(
  root: string,
  path: string,
  policy: GovernancePolicy,
  validator: ReturnType<typeof loadMetadataValidator>,
): Pick<InventoryRow, "owner" | "classification" | "classificationSource"> {
  if (!path.toLowerCase().endsWith(".md")) {
    throw new Error(`${path} 被配置为文档元数据范围，但不是 Markdown 文件。`);
  }

  const source = readFileSync(join(root, ...path.split("/")), "utf8");
  const metadata = parseMarkdownDocument(path, source).metadata;
  const profiles = policy.profiles.filter((profile) => matchesRule(path, profile.include, profile.exclude));
  if (profiles.length !== 1) {
    throw new Error(`${path} 必须精确匹配一个 metadata profile，实际匹配：${profiles.map(({ id }) => id).join(", ") || "无"}`);
  }
  const errors = validator.validate(profiles[0].schemaProfile, metadata);
  if (errors.length > 0) {
    throw new Error(`${path} 的文档元数据无效：${errors.join("；")}`);
  }

  const document = record(record(metadata, `${path} frontmatter`).document, `${path} document`);
  const owner = String(document.owner ?? "").trim();
  const classification = String(document.type ?? "").trim();
  if (!owner || !classification) {
    throw new Error(`${path} 的文档元数据必须声明 document.owner 与 document.type。`);
  }
  return { owner, classification, classificationSource: "文档元数据" };
}

function makeRow(
  root: string,
  path: string,
  policy: GovernancePolicy,
  validator: ReturnType<typeof loadMetadataValidator>,
): InventoryRow {
  const scope = resolveScope(path, policy);
  const identity = scope?.frontmatter === "documentation"
    ? documentIdentity(root, path, policy, validator)
    : scope
      ? { owner: GENERIC_OWNER, classification: scope.kind, classificationSource: "治理策略" as const }
      : { owner: GENERIC_OWNER, classification: "仓库文件", classificationSource: "通用回退" as const };

  return {
    path,
    area: getArea(path),
    fileType: getFileType(path),
    ...identity,
  };
}

function cell(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
}

function render(root: string): string {
  const policy = loadPolicy(root);
  const validator = loadMetadataValidator(root);
  assertPolicySchemaProfiles(policy, validator);
  const rows = gitTrackedFiles(root).map((path) => makeRow(root, path, policy, validator));

  return [
    "---",
    "schemaVersion: 1",
    "document:",
    "  type: router",
    "  status: current",
    "  owner: documentation-governance",
    "  authority:",
    "    subject: repository-inventory",
    "    kind: reference",
    "  readWhen:",
    "    - 检查受跟踪路径、文档分类与维护责任方时",
    "  sources:",
    "    - docs/_meta/documentation.schema.json",
    "    - docs/_meta/policy.yaml",
    "    - scripts/docs/generate-repo-inventory.ts",
    "  verifiedBy:",
    "    - npx tsx scripts/docs/generate-repo-inventory.ts --check",
    "  generator: scripts/docs/generate-repo-inventory.ts",
    "  inputs:",
    "    - '**'",
    "    - docs/_meta/documentation.schema.json",
    "    - docs/_meta/policy.yaml",
    "  regenerate: npx tsx scripts/docs/generate-repo-inventory.ts",
    "  check: npx tsx scripts/docs/generate-repo-inventory.ts --check",
    "---",
    "",
    "# 仓库清单",
    "",
    "本文件由 `scripts/docs/generate-repo-inventory.ts` 生成。路径来自 `git ls-files`；当前文档的分类与责任方来自已校验的同文件元数据；其他受治理路径的分类来自 `docs/_meta/policy.yaml` 中的 `scope.kind`。未声明语义归属的源码与资产使用通用责任方，不根据文件名猜测领域。",
    "",
    "| 路径 | 顶层区域 | 责任方 | 文件类型 | 分类 | 分类依据 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| \`${row.path}\` | \`${cell(row.area)}\` | \`${cell(row.owner)}\` | ${cell(row.fileType)} | \`${cell(row.classification)}\` | ${row.classificationSource} |`,
    ),
    "",
  ].join("\n");
}

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== "--check");
if (unknownArgs.length > 0) {
  throw new Error(`未知参数：${unknownArgs.join(", ")}`);
}

const root = process.cwd();
const output = render(root);
if (args.includes("--check")) {
  const current = existsSync(INVENTORY_PATH)
    ? readFileSync(INVENTORY_PATH, "utf8").replaceAll("\r\n", "\n")
    : null;
  if (current !== output) {
    console.error(`${INVENTORY_PATH} 已过时；请运行 npx tsx scripts/docs/generate-repo-inventory.ts 重新生成。`);
    process.exitCode = 1;
  }
} else {
  mkdirSync(dirname(INVENTORY_PATH), { recursive: true });
  writeFileSync(INVENTORY_PATH, output, "utf8");
}
