import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { load } from "js-yaml";

const RUNBOOK_PATH = "docs/runbooks/script-maintenance.md";

type RunbookMetadata = {
  document?: {
    type?: string;
    status?: string;
    owner?: string;
    sources?: string[];
    verificationState?: string;
    lastVerified?: string | null;
  };
};

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, "utf8");
}

function metadata(source: string): RunbookMetadata {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  assert.ok(match, `${RUNBOOK_PATH} must start with YAML frontmatter`);
  return load(match[1]) as RunbookMetadata;
}

test("script maintenance is a current task runbook instead of an exhaustive legacy matrix", () => {
  const source = read(RUNBOOK_PATH);
  const document = metadata(source).document;

  assert.equal(document?.type, "runbook");
  assert.equal(document?.status, "current");
  assert.equal(document?.owner, "repository-maintenance");
  assert.equal(document?.verificationState, "exercised");
  assert.equal(document?.lastVerified, "2026-07-14");
  assert.match(source, /^# 维护脚本$/m);
  assert.match(source, /不维护每个可导入内部模块的文件清单/);
  assert.match(source, /仓库清单生成分支已于 2026-07-14 在真实受跟踪目标上演练/);
  assert.match(source, /真实数据库操作均未实际演练/);
  assert.doesNotMatch(source, /Script Maintenance Matrix|docs\/script-maintenance\.md/);
});

test("high-risk maintenance entrypoints publish input, output, preview, write, and exit boundaries", () => {
  const source = read(RUNBOOK_PATH);
  const requiredEntrypoints = [
    "scripts/docs/generate-prisma-schema-compatibility.ts",
    "scripts/docs/generate-repo-inventory.ts",
    "scripts/cleanup-latent-artifacts.mjs",
    "scripts/db/collapse-preset-group-bindings.ts",
    "scripts/db/migrate-zero-redundancy.ts",
    "scripts/db/verify-zero-redundancy.ts",
    "scripts/fix-position-presets.py",
    "src/scripts/backfill-comfy-output-subfolder.ts",
    "scripts/migrate-preset-variants.sql",
    "scripts/migrate-sqlite.sql",
    "src/scripts/seed.mts",
  ];

  for (const path of requiredEntrypoints) {
    assert.ok(existsSync(path), `${path} must exist`);
    assert.match(source, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(metadata(source).document?.sources?.includes(path), `${path} must be a runbook source`);
  }

  for (const heading of ["输入与输出", "预演或只读模式", "写入与退出语义"]) {
    assert.match(source, new RegExp(`\\| ${heading} \\|`));
  }
  assert.match(source, /计划行和删除发生在同一进程中/);
  assert.match(source, /实际 CLI 不会回退到环境变量/);
  assert.match(source, /运行手册只承诺显式命令行参数/);
  assert.match(source, /真实目标仍由进程环境决定/);
  assert.match(source, /退出 `0` 不能证明目标存在/);
  assert.match(source, /退出 `0` 也可能只记录了顶层错误/);
});

test("runbook safety claims remain grounded in the current script implementations", () => {
  const cleanup = read("scripts/cleanup-latent-artifacts.mjs");
  assert.ok(cleanup.indexOf("console.log(JSON.stringify(plan))") < cleanup.indexOf("await deletePlannedLatentArtifacts(plan)"));
  assert.doesNotMatch(cleanup, /--dry-run/);

  const collapse = read("scripts/db/collapse-preset-group-bindings.ts");
  assert.match(collapse, /return \{ databaseUrl, dryRun: !write, write, format \}/);
  assert.match(collapse, /--write cannot be combined with --dry-run/);
  assert.match(collapse, /collapsePresetGroupBindings\(args\)/);
  assert.match(collapse, /let databaseUrl: string \| null = null/);

  const migration = read("scripts/db/migrate-zero-redundancy.ts");
  assert.match(migration, /if \(args\.write\)/);
  for (const parsedButUnused of ["args.provider", "args.sourceDbPath", "args.verify", "args.verifierArgs"]) {
    assert.doesNotMatch(migration, new RegExp(parsedButUnused.replace(".", "\\.")));
  }

  const verifier = read("scripts/db/verify-zero-redundancy.ts");
  assert.match(verifier, /invalidJson:\s*2/);
  assert.match(verifier, /invalidReference:\s*4/);
  assert.match(verifier, /resolverMismatch:\s*8/);

  for (const generator of [
    "scripts/docs/generate-prisma-schema-compatibility.ts",
    "scripts/docs/generate-repo-inventory.ts",
  ]) {
    const generatorSource = read(generator);
    assert.match(generatorSource, /args\.includes\("--check"\)/);
    assert.match(generatorSource, /process\.exitCode = 1/);
  }

  const backfill = read("src/scripts/backfill-comfy-output-subfolder.ts");
  assert.match(backfill, /submittedPrompt/);
  assert.match(backfill, /prompt\?\.\["515"\]/);
  assert.match(backfill, /\.catch\(console\.error\)/);
  assert.doesNotMatch(backfill, /process\.exitCode|process\.exit\(/);
});

test("collapse preset group bindings CLI does not silently fall back to DATABASE_URL", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/db/collapse-preset-group-bindings.ts"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "file:./this-env-value-must-not-be-used.db" },
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL is required/);
});

test("agent and runbook routers point maintenance mutations to the current runbook", () => {
  for (const path of ["AGENTS.md", "docs/runbooks/README.md"]) {
    const source = read(path);
    assert.match(source, /维护脚本/);
    assert.match(source, /docs\/runbooks\/script-maintenance\.md|\.\/script-maintenance\.md/);
    assert.doesNotMatch(source, /docs\/script-maintenance\.md/);
  }
});
