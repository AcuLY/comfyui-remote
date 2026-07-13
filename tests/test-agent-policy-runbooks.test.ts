import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import { load } from "js-yaml";

type Frontmatter = {
  document?: {
    type?: string;
    sources?: string[];
    verificationState?: string;
    lastVerified?: string | null;
  };
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function parseFrontmatter(path: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(read(path));
  assert.ok(match, `${path} must start with YAML frontmatter`);
  return load(match[1]) as Frontmatter;
}

function powershellBlocks(source: string): string[] {
  return [...source.matchAll(/^[ \t]*```powershell[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gm)].map(
    (match) => match[1],
  );
}

function assertInOrder(source: string, markers: string[]): void {
  let cursor = -1;
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor + 1);
    assert.ok(next > cursor, `${JSON.stringify(marker)} must occur in the required order`);
    cursor = next;
  }
}

function listMarkdown(root: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...listMarkdown(path));
    else if (entry.name.endsWith(".md")) paths.push(path);
  }
  return paths;
}

function assertSources(path: string, expected: string[]): void {
  const sources = parseFrontmatter(path).document?.sources ?? [];
  for (const source of expected) {
    assert.ok(sources.includes(source), `${path} must cite ${source}`);
  }
}

test("AGENTS is the single hard-policy authority and routes every operational trigger", () => {
  const agents = read("AGENTS.md");
  const claude = read("CLAUDE.md");
  const openspec = read("openspec/config.yaml");

  assert.match(agents, /普通开发工作流硬策略的唯一权威/);
  assert.match(agents, /保留无关工作树改动/);
  assert.match(agents, /不跳过默认提交与推送/);
  assert.match(agents, /Git 暂存、提交和推送不受 `\.deploy\.lock` 保护/);
  assert.match(agents, /只有本地 `next dev` 时默认留在开发验证/);
  assert.match(agents, /当前检出或 `mypc` 存在 `next start` 时/);
  assert.match(agents, /禁止使用 `Stop-Process -Name node -Force`/);
  assert.match(agents, /node_modules\/next\/dist\/docs\//);
  assert.match(agents, /只从项目根 `\.env` 读取 token/);
  assert.match(agents, /已有计划包含可独立执行的模块时，优先交给子代理/);

  for (const route of [
    "docs/runbooks/README.md",
    "docs/runbooks/git-delivery.md",
    "docs/runbooks/script-maintenance.md",
    "docs/runbooks/development/dev-service.md",
    "docs/runbooks/development/local-verification.md",
    "docs/runbooks/deployment/README.md",
    "docs/runbooks/mypc/powershell-over-ssh.md",
  ]) {
    assert.match(agents, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(existsSync(route), `${route} must exist`);
  }

  assert.match(claude, /@AGENTS\.md/);
  assert.match(claude, /唯一权威是 \[AGENTS\.md\]\(AGENTS\.md\)/);
  assert.doesNotMatch(claude, /部署锁|队列暂停|Prisma 同步/);
  assert.match(openspec, /唯一入口是 AGENTS\.md/);
  assert.match(openspec, /docs\/runbooks\/\*\*/);
  assert.match(agents, /\[文档索引\]\(docs\/README\.md\)/);
  assert.match(agents, /\[本地数据库初始化\]\(docs\/runbooks\/development\/database-bootstrap\.md\)/);

  for (const source of [agents, claude, openspec]) {
    assert.doesNotMatch(source, /\$docs-audit|agent-rules\//);
  }
});

test("local database bootstrap has a single PowerShell-safe and destructive owner", () => {
  const root = read("README.md");
  const development = read("docs/runbooks/development/README.md");
  const bootstrap = read("docs/runbooks/development/database-bootstrap.md");

  assert.match(root, /\[本地数据库初始化\]\(docs\/runbooks\/development\/database-bootstrap\.md\)/);
  assert.match(development, /\[数据库初始化\]\(\.\/database-bootstrap\.md\)/);
  assert.match(bootstrap, /只为全新或明确可丢弃的本地开发数据库/);
  assert.match(bootstrap, /不得对生产、共享或身份不明的数据库运行/);
  assert.match(bootstrap, /npm run db:bootstrap/);
  assert.match(bootstrap, /不要直接运行 `npm run db:bootstrap:sqlite`/);
  assert.match(bootstrap, /会清理部分运行、图片、回收站和提示词块记录/);
  assert.match(bootstrap, /verificationState: not-exercised/);
});

test("superseded policy tree is absent from the accepted worktree", () => {
  const supersededPolicyRoot = ["agent", "rules"].join("-");
  assert.equal(existsSync(supersededPolicyRoot), false);

  for (const path of [
    "AGENTS.md",
    "CLAUDE.md",
    "openspec/config.yaml",
    "README.md",
    "docs/README.md",
    "scripts/docs/generate-repo-inventory.ts",
  ]) {
    assert.doesNotMatch(read(path), /agent-rules\//, `${path} must not keep a live legacy route`);
  }
});

test("Git scope distinguishes local-only from no-deploy and push-only", () => {
  const delivery = read("docs/runbooks/git-delivery.md");
  const deployment = read("docs/runbooks/deployment/README.md");

  assert.match(delivery, /不会跳过默认的有边界提交和推送/);
  assert.match(
    delivery,
    /显式 `local-only` 会跳过全部 Git 交付：不得暂存、提交或推送/,
  );
  assert.match(deployment, /显式 `no-deploy` 或 `push-only` 会跳过生产部署，但不会跳过默认的有边界提交与推送/);
  assert.match(
    deployment,
    /显式 `local-only` 会跳过生产部署，同时跳过暂存、提交与推送/,
  );
  assert.doesNotMatch(deployment, /local-only[^。]*仍(?:然)?进行 Git 交付/);
});

test("deployment router preserves the lock, dual-worker, build, restart, verify, and recovery order", () => {
  const deployment = read("docs/runbooks/deployment/README.md");
  assertInOrder(deployment, [
    "1. 交付 Git 变更；",
    "2. 选择真实目标环境与精确目标检出；",
    "3. 获取该目标检出的部署锁；",
    "4. 同时读取 Generation 与 Training worker 状态；",
    "5. Training 活跃时停止，否则仅在必要时暂停 Generation；",
    "6. 仅当 schema 变化时同步真实数据库 provider；",
    "7. 依次构建、重启、验证；",
    "8. 只恢复本次部署暂停的 Generation 批次；",
    "9. 释放锁。",
  ]);
  assert.match(deployment, /绝不重排 `构建 → 重启 → 验证`/);
  assert.match(deployment, /必须先确定精确目标检出，再接触该检出的锁/);
});

test("PowerShell harness executes high-risk runbook control-flow contracts", () => {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "tests/runbook-contract-harness.ps1"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    `runbook PowerShell contract harness failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /全部 runbook PowerShell 合同通过/);
});

test("provider, cache, process, and log boundaries remain grounded in repository contracts", () => {
  assertSources("docs/runbooks/deployment/README.md", ["AGENTS.md"]);
  assertSources("docs/runbooks/script-maintenance.md", [
    "scripts/cleanup-latent-artifacts.mjs",
    "scripts/db/collapse-preset-group-bindings.ts",
    "scripts/db/migrate-zero-redundancy.ts",
    "src/scripts/backfill-comfy-output-subfolder.ts",
  ]);
  assertSources("docs/runbooks/development/README.md", ["AGENTS.md"]);
  assertSources("docs/runbooks/development/dev-service.md", ["AGENTS.md"]);
  assertSources("docs/runbooks/deployment/next-build.md", [
    "AGENTS.md",
    "prisma.config.ts",
    "prisma/schema.prisma",
    "prisma/schema.sqlite.prisma",
    "node_modules/next/dist/build/index.js",
  ]);
  assertSources("docs/runbooks/deployment/service-restart.md", [
    "AGENTS.md",
    "docs/runbooks/deployment/next-build.md",
  ]);
  assertSources("docs/runbooks/deployment/queue-safety.md", [
    "src/proxy.ts",
    "src/lib/actions/run-lifecycle.ts",
    "src/lib/api-response.ts",
  ]);
  assertSources("docs/runbooks/deployment/database-sync.md", [
    ".env.example",
    "prisma.config.ts",
    "src/lib/prisma.ts",
  ]);

  const database = read("docs/runbooks/deployment/database-sync.md");
  assert.match(database, /\$envPath = Join-Path \$repo "\.env"/);
  assert.match(database, /Push-Location -LiteralPath \$repo/);
  assert.match(database, /Remove-Item Env:DB_PROVIDER/);
  assert.match(database, /Remove-Item Env:DATABASE_URL/);
  assert.match(database, /DB_PROVIDER 与目标 DATABASE_URL 冲突/);

  const build = read("docs/runbooks/deployment/next-build.md");
  const buildBlock = powershellBlocks(build).find((block) =>
    block.includes("# runbook-contract: deployment-next-build"),
  );
  assert.ok(buildBlock);
  assert.match(build, /worktree add --detach \$candidateWorktree \$deploymentCommit/);
  assert.match(build, /CommandLine -like "\*\$candidateBuildPrefix\*"/);
  assert.match(build, /Push-Location -LiteralPath \$candidateWorktree/);
  assert.match(build, /npm ci --no-audit --no-fund/);
  assert.match(build, /\$env:DB_PROVIDER = "postgresql"/);
  assert.match(build, /\$env:DB_PROVIDER = "sqlite"/);
  assert.doesNotMatch(buildBlock, /prisma db push/);
  assert.match(build, /Move-Item -LiteralPath \$worktreeNext -Destination \$candidateNext/);
  assert.match(build, /worktree remove \$candidateWorktree/);
  assert.match(build, /构建期间绝不读取、写入、删除或重命名活跃检出的 \.next/);
  assertInOrder(build, [
    "worktree add --detach $candidateWorktree $deploymentCommit",
    "Push-Location -LiteralPath $candidateWorktree",
    "& npm ci --no-audit --no-fund",
    '$env:DB_PROVIDER = "postgresql"',
    "& npx prisma generate",
    '$env:DB_PROVIDER = "sqlite"',
    "& npx prisma generate",
    "if ($savedDbProviderExists) { $env:DB_PROVIDER = $savedDbProvider }",
    "else { Remove-Item Env:DB_PROVIDER -ErrorAction SilentlyContinue }",
    "& npx next build --webpack",
    "Move-Item -LiteralPath $worktreeNext -Destination $candidateNext",
    "worktree remove $candidateWorktree",
  ]);
  assert.doesNotMatch(build, /Push-Location -LiteralPath \$repo\s+[\s\S]{0,160}& npx next build/);

  const production = read("docs/runbooks/deployment/service-restart.md");
  assert.match(production, /CommandLine -like "\*\$repo\*"/);
  assert.match(production, /CommandLine -match 'next\.\*\\bstart\\b'/);
  assert.match(production, /Stop-Process -Id \$process\.ProcessId/);
  assert.match(production, /\$servicePorts = @\(\$oldListeners[\s\S]*Sort-Object -Unique/);
  assert.match(production, /\$servicePort = \[int\]\$servicePorts\[0\]/);
  assert.match(production, /\$expectedCandidateNext = \[System\.IO\.Path\]::GetFullPath/);
  assert.match(production, /\[string\]::Equals\(\s*\$candidateNext,\s*\$expectedCandidateNext,/);
  assert.match(production, /required-server-files\.json/);
  assert.match(production, /\$candidateServerFiles\.config\.distDir -ne "\.next"/);
  assert.match(production, /Move-Item -LiteralPath \$activeNext -Destination \$backupNext/);
  assert.match(production, /Move-Item -LiteralPath \$candidateNext -Destination \$activeNext/);
  assert.match(production, /npx next start -p \$servicePort/);
  assert.match(production, /> server\.log 2> server\.err\.log/);
  assert.doesNotMatch(production, /server-prod(?:\.err)?\.log/);
  assertInOrder(production, [
    "# runbook-contract: production-artifact-preflight",
    "# runbook-contract: production-service-stop",
    "旧生产监听仍未消失",
    "# runbook-contract: production-artifact-swap",
    "Move-Item -LiteralPath $activeNext -Destination $backupNext",
    "Move-Item -LiteralPath $candidateNext -Destination $activeNext",
    "npx next start -p $servicePort",
  ]);

  const development = read("docs/runbooks/development/dev-service.md");
  assert.match(development, /CommandLine -like "\*\$repo\*"/);
  assert.match(development, /CommandLine -match 'next\.\*\\bdev\\b'/);
  assert.match(development, /Stop-Process -Id \$process\.ProcessId/);
});

test("local verification clears every token-derived object in a finally block", () => {
  const source = read("docs/runbooks/development/local-verification.md");
  assertSources("docs/runbooks/development/local-verification.md", [
    "src/app/api/worker/status/route.ts",
    "src/server/services/comfyui-service.ts",
    "src/server/services/comfy-ssh.ts",
  ]);
  const authBlock = powershellBlocks(source).find((block) => block.includes("$authRequest = @{"));
  assert.ok(authBlock);
  assert.match(authBlock, /\$sshTunnelPreflight -notin/);
  assertInOrder(authBlock, ["try {", "$authResponse = Invoke-RestMethod", "} finally {"]);
  assert.match(authBlock, /\$session\.Cookies = \[System\.Net\.CookieContainer\]::new\(\)/);
  for (const variable of [
    "token",
    "body",
    "authRequest",
    "authResponse",
    "authCookie",
    "session",
  ]) {
    assert.match(authBlock, new RegExp(`Remove-Variable[\\s\\S]*\\b${variable}\\b`));
  }
  assert.match(authBlock, /\$envPath = Join-Path \$repo "\.env"/);
  assert.match(source, /detached: true/);
  assert.match(source, /目前没有公开停止 API/);
  assert.match(source, /必须在请求前完成授权/);
  assert.match(source, /verificationState: not-exercised/);
  assert.match(source, /lastVerified: null/);
});

test("every current runbook document validates against its selected strict profile", () => {
  const schema = JSON.parse(read("docs/_meta/documentation.schema.json")) as { $id: string };
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema);

  for (const path of listMarkdown("docs/runbooks")) {
    if (!read(path).startsWith("---")) continue;
    const metadata = parseFrontmatter(path);
    const profile = metadata.document?.type;
    assert.ok(profile === "router" || profile === "runbook", `${path} has unexpected profile`);
    const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/${profile}` });
    assert.equal(
      validate(metadata),
      true,
      `${path} violates ${profile}: ${JSON.stringify(validate.errors)}`,
    );
  }
});

test("no unexercised runbook publishes a verification date", () => {
  const exercised: string[] = [];
  const runbooks: string[] = [];

  for (const path of listMarkdown("docs/runbooks")) {
    if (!read(path).startsWith("---")) continue;
    const document = parseFrontmatter(path).document;
    if (document?.type !== "runbook") continue;
    const normalized = relative(".", path).replaceAll("\\", "/");
    runbooks.push(normalized);
    if (document.verificationState === "exercised") {
      exercised.push(normalized);
      assert.match(String(document.lastVerified), /^\d{4}-\d{2}-\d{2}$/);
    } else {
      assert.equal(document?.verificationState, "not-exercised");
      assert.equal(document?.lastVerified, null);
    }
  }

  assert.ok(runbooks.length >= 10);
  assert.deepEqual(exercised, []);
});

test("the current runbook router does not expose the superseded config runtime page", () => {
  const router = read("docs/runbooks/README.md");
  assert.doesNotMatch(router, /config-runtime-assets\.md/);
  assert.doesNotMatch(router, /Configuration and runtime assets/);
});
