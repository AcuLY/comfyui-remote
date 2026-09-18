import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { captureWorktreeSnapshot } from "../scripts/docs/check/git";
import { loadPolicy } from "../scripts/docs/check/config";
import { runConfiguredAdapters } from "../scripts/docs/check/adapters";

const REPO_ROOT = process.cwd();
const TSX_CLI = join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CHECKER = join(REPO_ROOT, "scripts", "docs", "check.ts");
const FIXTURE = join(REPO_ROOT, "tests", "fixtures", "documentation-governance", "checker", "valid-repository");

async function git(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function gitOutput(root: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function createRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "docs-check-"));
  await cp(FIXTURE, root, { recursive: true });
  const fixturePolicy = join(root, "docs", "_meta", "policy.yaml");
  await writeFile(fixturePolicy, (await readFile(fixturePolicy, "utf8")).replace(/\r\n?/g, "\n"));
  await writeFile(join(root, ".gitignore"), "node_modules/\n");
  await writeFile(
    join(root, "package.json"),
    '{"private":true,"devDependencies":{"@fission-ai/openspec":"1.5.0"}}\n',
  );
  await mkdir(join(root, "scripts", "skills"), { recursive: true });
  await writeFile(
    join(root, "scripts", "skills", "validate.mjs"),
    'process.stdout.write(JSON.stringify({ diagnostics: [], exitCode: 0 }) + "\\n");\n',
  );
  await mkdir(join(root, "node_modules", "@fission-ai", "openspec", "bin"), { recursive: true });
  await writeFile(
    join(root, "node_modules", "@fission-ai", "openspec", "package.json"),
    '{"name":"@fission-ai/openspec","version":"1.5.0"}\n',
  );
  await writeFile(
    join(root, "node_modules", "@fission-ai", "openspec", "bin", "openspec.js"),
    'process.stdout.write(JSON.stringify({ items: [] }) + "\\n");\n',
  );
  await git(root, "init", "--quiet");
  await git(root, "config", "user.name", "Docs Check Test");
  await git(root, "config", "user.email", "docs-check@example.invalid");
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "fixture baseline");
  return root;
}

async function addGeneratorAdapter(root: string, id: string): Promise<string> {
  const policyPath = join(root, "docs", "_meta", "policy.yaml");
  const policy = await readFile(policyPath, "utf8");
  await writeFile(
    policyPath,
    policy
      .replace(
        "adapters:\n",
        [
          `  - id: ${id}-relationship`,
          "    kind: contract",
          "    sources: [src/example.ts]",
          "    documents: [docs/guide.md]",
          "    owner: documentation",
          `    verifier: ${id}`,
          "adapters:",
          "",
        ].join("\n"),
      )
      .replace(
        "  generators: []",
        [
          "  generators:",
          `    - id: ${id}`,
          `      command: [tsx, scripts/docs/${id}.mjs, --check]`,
          "      owner: documentation",
          "      output: docs/guide.md",
        ].join("\n"),
      ),
  );
  await mkdir(join(root, "scripts", "docs"), { recursive: true });
  await mkdir(join(root, "node_modules", "tsx", "dist"), { recursive: true });
  await writeFile(
    join(root, "node_modules", "tsx", "dist", "cli.mjs"),
    "import { pathToFileURL } from 'node:url'; await import(pathToFileURL(process.argv[2]).href);\n",
  );
  return join(root, "scripts", "docs", `${id}.mjs`);
}

async function addContractAdapter(root: string, id: string): Promise<string> {
  const policyPath = join(root, "docs", "_meta", "policy.yaml");
  const policy = await readFile(policyPath, "utf8");
  await writeFile(
    policyPath,
    policy
      .replace(
        "adapters:\n",
        [
          `  - id: ${id}-relationship`,
          "    kind: contract",
          "    sources: [src/example.ts]",
          "    documents: [docs/guide.md]",
          "    owner: documentation",
          `    verifier: ${id}`,
          "adapters:",
          "",
        ].join("\n"),
      )
      .replace(
        "  generators: []\n  contracts: []",
        [
          "  generators: []",
          "  contracts:",
          `    - id: ${id}`,
          "      kind: route-api-mcp-documentation",
          "      owner: documentation",
          "      output: docs/guide.md",
        ].join("\n"),
      ),
  );
  const updatedPolicy = await readFile(policyPath, "utf8");
  assert.match(updatedPolicy, new RegExp(`id: ${id}`));
  assert.match(updatedPolicy, /contracts:\n\s+- id:/);
  assert.equal(loadPolicy(root).adapters.contracts.some((adapter) => adapter.id === id), true);
  await mkdir(join(root, "scripts", "docs", "check"), { recursive: true });
  await cp(
    join(REPO_ROOT, "scripts", "docs", "check", "contract-runner.mjs"),
    join(root, "scripts", "docs", "check", "contract-runner.mjs"),
  );
  await mkdir(join(root, "tests"), { recursive: true });
  return join(root, "tests", "test-documentation-governance.test.ts");
}

function runChecker(root: string, args: string[] = []) {
  return spawnSync(process.execPath, [TSX_CLI, CHECKER, "--root", root, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, OPENSPEC_TELEMETRY: "0" },
  });
}

test("docs checker returns JSON success without modifying a dirty repository", async () => {
  const root = await createRepository();
  try {
    await writeFile(join(root, "notes.txt"), Buffer.from([0, 1, 2, 3]));
    await writeFile(join(root, "docs", "guide.md"), `${await readFile(join(root, "docs", "guide.md"), "utf8")}\n`);
    await git(root, "add", "docs/guide.md");
    await writeFile(join(root, "README.md"), `${await readFile(join(root, "README.md"), "utf8")}\n`);
    const before = await captureWorktreeSnapshot(root);

    const result = runChecker(root, ["--format", "json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.summary.errors, 0);
    assert.equal(payload.requestedMode, "full");
    assert.deepEqual(await captureWorktreeSnapshot(root), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("docs checker distinguishes rule violations from configuration failures", async () => {
  const root = await createRepository();
  try {
    await writeFile(
      join(root, "docs", "guide.md"),
      `${await readFile(join(root, "docs", "guide.md"), "utf8")}\n[missing](missing.md)\n`,
    );
    const violation = runChecker(root, ["--format", "json"]);
    assert.equal(violation.status, 1, violation.stderr || violation.stdout);
    assert.ok(JSON.parse(violation.stdout).diagnostics.some((item: { ruleId: string }) => item.ruleId === "links/target-missing"));

    await writeFile(join(root, "docs", "_meta", "policy.yaml"), "schemaVersion: [not valid");
    const failure = runChecker(root, ["--format", "json"]);
    assert.equal(failure.status, 2, failure.stderr || failure.stdout);
    assert.ok(JSON.parse(failure.stdout).diagnostics.some((item: { ruleId: string }) => item.ruleId === "tool/configuration"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("first-party Markdown parse failures cannot bypass the language gate outside governed scope", async () => {
  const root = await createRepository();
  try {
    const report = join(root, "reports", "quality", "report.md");
    await mkdir(dirname(report), { recursive: true });
    await writeFile(report, "---\ntitle: missing closing delimiter\nEnglish report body\n");
    await git(root, "add", "reports/quality/report.md");

    const result = runChecker(root, ["--format", "json"]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.ok(
      payload.diagnostics.some((item: { ruleId: string; path: string }) =>
        item.ruleId === "language/markdown-parse" && item.path === "reports/quality/report.md"),
      JSON.stringify(payload.diagnostics),
    );

    await writeFile(report, "# 中文报告\n\n```text\nEnglish payload without a closing fence\n");
    await git(root, "add", "reports/quality/report.md");
    const unclosedFence = runChecker(root, ["--format", "json"]);
    assert.equal(unclosedFence.status, 1, unclosedFence.stderr || unclosedFence.stdout);
    const unclosedPayload = JSON.parse(unclosedFence.stdout);
    assert.ok(
      unclosedPayload.diagnostics.some((item: { ruleId: string; path: string; evidence: string }) =>
        item.ruleId === "language/markdown-parse"
        && item.path === "reports/quality/report.md"
        && item.evidence.includes("closing fence")),
      JSON.stringify(unclosedPayload.diagnostics),
    );

    await writeFile(report, "# 中文报告\n\n> ```text\n> English hidden prose\n");
    await git(root, "add", "reports/quality/report.md");
    const unclosedQuote = runChecker(root, ["--format", "json"]);
    assert.equal(unclosedQuote.status, 1, unclosedQuote.stderr || unclosedQuote.stdout);
    assert.ok(
      JSON.parse(unclosedQuote.stdout).diagnostics.some((item: { ruleId: string; path: string }) =>
        item.ruleId === "language/markdown-parse" && item.path === "reports/quality/report.md"),
      unclosedQuote.stdout,
    );

    await writeFile(report, "# 中文报告\n\n- ```text\n  English code payload\n  ```\n");
    await git(root, "add", "reports/quality/report.md");
    const closedList = runChecker(root, ["--format", "json"]);
    assert.equal(closedList.status, 0, closedList.stderr || closedList.stdout);
    assert.equal(
      JSON.parse(closedList.stdout).diagnostics.some((item: { ruleId: string; path: string }) =>
        item.ruleId === "language/markdown-parse" && item.path === "reports/quality/report.md"),
      false,
      closedList.stdout,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uppercase Markdown extensions remain inside finite scope and the language gate", async () => {
  const root = await createRepository();
  try {
    await writeFile(join(root, "REPORT.MD"), "# English report\n");
    await git(root, "add", "REPORT.MD");

    const result = runChecker(root, ["--format", "json"]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    for (const ruleId of ["scope/unregistered", "language/required-language"]) {
      assert.ok(
        payload.diagnostics.some((item: { ruleId: string; path: string }) =>
          item.ruleId === ruleId && item.path === "REPORT.MD"),
        `${ruleId}: ${JSON.stringify(payload.diagnostics)}`,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an explicit comparison base must resolve and share history with HEAD", async () => {
  const root = await createRepository();
  const unrelated = await mkdtemp(join(tmpdir(), "docs-check-unrelated-"));
  try {
    const missing = runChecker(root, ["--base", "refs/heads/does-not-exist", "--format", "json"]);
    assert.equal(missing.status, 2, missing.stderr || missing.stdout);
    assert.match(JSON.parse(missing.stdout).diagnostics[0].evidence, /does not resolve to a commit/i);

    await git(unrelated, "init", "--quiet");
    await git(unrelated, "config", "user.name", "Unrelated Test");
    await git(unrelated, "config", "user.email", "unrelated@example.invalid");
    await writeFile(join(unrelated, "unrelated.txt"), "unrelated history\n");
    await git(unrelated, "add", "unrelated.txt");
    await git(unrelated, "commit", "--quiet", "-m", "unrelated root");
    const unrelatedCommit = gitOutput(unrelated, "rev-parse", "HEAD");
    await git(root, "fetch", "--quiet", unrelated, `${unrelatedCommit}:refs/heads/unrelated-history`);

    const noMergeBase = runChecker(root, ["--base", "refs/heads/unrelated-history", "--format", "json"]);
    assert.equal(noMergeBase.status, 2, noMergeBase.stderr || noMergeBase.stdout);
    assert.match(JSON.parse(noMergeBase.stdout).diagnostics[0].evidence, /no merge base with HEAD/i);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(unrelated, { recursive: true, force: true });
  }
});

test("required generator drift exits 1 while an adapter crash exits 2", async () => {
  const root = await createRepository();
  try {
    const adapterPath = await addGeneratorAdapter(root, "controlled-check");
    await writeFile(adapterPath, "console.error('docs/guide.md is stale'); process.exitCode = 1;\n");
    const drift = runChecker(root, ["--format", "json"]);
    assert.equal(drift.status, 1, drift.stderr || drift.stdout);
    assert.ok(
      JSON.parse(drift.stdout).diagnostics.some(
        (item: { ruleId: string }) => item.ruleId === "generator/controlled-check",
      ),
    );

    await writeFile(adapterPath, "throw new Error('adapter boom');\n");
    const crash = runChecker(root, ["--format", "json"]);
    assert.equal(crash.status, 2, crash.stderr || crash.stdout);
    assert.ok(
      JSON.parse(crash.stdout).diagnostics.some(
        (item: { ruleId: string }) => item.ruleId === "tool/configuration",
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("contract adapters distinguish assertion mismatches from syntax and import crashes", async () => {
  const root = await createRepository();
  try {
    const contractTest = await addContractAdapter(root, "structured-contract");
    await writeFile(
      contractTest,
      [
        'const assert = require("node:assert/strict");',
        'const test = require("node:test");',
        'test("deterministic mismatch", () => assert.equal(1, 2));',
        "",
      ].join("\n"),
    );
    const adapterResult = runConfiguredAdapters(root, loadPolicy(root));
    assert.ok(
      adapterResult.some(({ ruleId }) => ruleId === "contract/structured-contract"),
      JSON.stringify(adapterResult),
    );
    const mismatch = runChecker(root, ["--format", "json"]);
    assert.equal(mismatch.status, 1, mismatch.stderr || mismatch.stdout);
    assert.ok(
      JSON.parse(mismatch.stdout).diagnostics.some(
        (item: { ruleId: string }) => item.ruleId === "contract/structured-contract",
      ),
    );

    await writeFile(contractTest, "export const broken = ;\n");
    const syntaxCrash = runChecker(root, ["--format", "json"]);
    assert.equal(syntaxCrash.status, 2, syntaxCrash.stderr || syntaxCrash.stdout);
    assert.ok(
      JSON.parse(syntaxCrash.stdout).diagnostics.some(
        (item: { ruleId: string }) => item.ruleId === "tool/configuration",
      ),
    );

    await writeFile(contractTest, 'require("missing-contract-module");\n');
    const importCrash = runChecker(root, ["--format", "json"]);
    assert.equal(importCrash.status, 2, importCrash.stderr || importCrash.stdout);
    assert.match(JSON.parse(importCrash.stdout).diagnostics[0].evidence, /failed as a tool/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finite docs scope rejects tracked non-document assets and unknown schema profiles", async () => {
  const root = await createRepository();
  try {
    await writeFile(join(root, "docs", "runtime.json"), "{}\n");
    await git(root, "add", "docs/runtime.json");
    const topology = runChecker(root, ["--format", "json"]);
    assert.equal(topology.status, 1, topology.stderr || topology.stdout);
    assert.ok(
      JSON.parse(topology.stdout).diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "scope/unregistered" && item.path === "docs/runtime.json",
      ),
    );

    await git(root, "reset", "--quiet", "HEAD", "docs/runtime.json");
    await rm(join(root, "docs", "runtime.json"));
    const policyPath = join(root, "docs", "_meta", "policy.yaml");
    await writeFile(
      policyPath,
      (await readFile(policyPath, "utf8")).replace("schemaProfile: architecture", "schemaProfile: missing-profile"),
    );
    const profile = runChecker(root, ["--format", "json"]);
    assert.equal(profile.status, 2, profile.stderr || profile.stdout);
    assert.match(JSON.parse(profile.stdout).diagnostics[0].evidence, /unknown schema profile/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("policy and metadata schema typos fail as tool configuration errors", async () => {
  const root = await createRepository();
  try {
    const policyPath = join(root, "docs", "_meta", "policy.yaml");
    const policy = await readFile(policyPath, "utf8");
    await writeFile(policyPath, policy.replace("rootEntrypoints:\n  - README.md\n", ""));
    const omitted = runChecker(root, ["--format", "json"]);
    assert.equal(omitted.status, 2, omitted.stderr || omitted.stdout);
    assert.match(JSON.parse(omitted.stdout).diagnostics[0].evidence, /missing required key.*rootEntrypoints/i);

    await writeFile(policyPath, policy.replace("enabled: true", "enabled: false"));
    const disabled = runChecker(root, ["--format", "json"]);
    assert.equal(disabled.status, 2, disabled.stderr || disabled.stdout);
    assert.match(JSON.parse(disabled.stdout).diagnostics[0].evidence, /openspec.enabled must be true/i);

    await writeFile(policyPath, policy.replace("forbiddenLivePaths:", "forbiddenLivePath:"));
    const rootTypo = runChecker(root, ["--format", "json"]);
    assert.equal(rootTypo.status, 2, rootTypo.stderr || rootTypo.stdout);
    assert.match(JSON.parse(rootTypo.stdout).diagnostics[0].evidence, /unknown key.*forbiddenLivePath/i);

    await writeFile(policyPath, policy.replace("frontmatter: documentation", "frontmatterTypo: documentation"));
    const scopeTypo = runChecker(root, ["--format", "json"]);
    assert.equal(scopeTypo.status, 2, scopeTypo.stderr || scopeTypo.stdout);
    assert.match(JSON.parse(scopeTypo.stdout).diagnostics[0].evidence, /unknown key.*frontmatterTypo/i);

    await writeFile(policyPath, policy.replace("requiredLanguage: zh-CN", "requiredLanguage: en-US"));
    const invalidLanguage = runChecker(root, ["--format", "json"]);
    assert.equal(invalidLanguage.status, 2, invalidLanguage.stderr || invalidLanguage.stdout);
    assert.match(JSON.parse(invalidLanguage.stdout).diagnostics[0].evidence, /requiredLanguage must equal zh-CN/i);

    await writeFile(policyPath, policy);
    const schemaPath = join(root, "docs", "_meta", "documentation.schema.json");
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    schema.$defs.common.unknownSchemaKeyword = true;
    await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
    const schemaTypo = runChecker(root, ["--format", "json"]);
    assert.equal(schemaTypo.status, 2, schemaTypo.stderr || schemaTypo.stdout);
    assert.match(JSON.parse(schemaTypo.stdout).diagnostics[0].evidence, /unknown keyword.*unknownSchemaKeyword/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("root entrypoints must remain tracked and governed", async () => {
  const root = await createRepository();
  try {
    await git(root, "rm", "--quiet", "README.md");
    const missing = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(missing.status, 1, missing.stderr || missing.stdout);
    const payload = JSON.parse(missing.stdout);
    assert.equal(payload.effectiveMode, "full");
    assert.ok(
      payload.diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "topology/root-entrypoint-missing" && item.path === "README.md",
      ),
    );

    await writeFile(join(root, "NOTICE.txt"), "tracked but not governed\n");
    await git(root, "add", "NOTICE.txt");
    const policyPath = join(root, "docs", "_meta", "policy.yaml");
    await writeFile(
      policyPath,
      (await readFile(policyPath, "utf8")).replace(
        "rootEntrypoints:\n  - README.md",
        "rootEntrypoints:\n  - README.md\n  - NOTICE.txt",
      ),
    );
    const ungoverned = runChecker(root, ["--format", "json"]);
    assert.equal(ungoverned.status, 1, ungoverned.stderr || ungoverned.stdout);
    assert.ok(
      JSON.parse(ungoverned.stdout).diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "topology/root-entrypoint-ungoverned" && item.path === "NOTICE.txt",
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("forbidden runtime consumers fail while comments, fixtures, and OpenSpec evidence are excluded", async () => {
  const root = await createRepository();
  try {
    const consumerPath = join(root, "src", "consumer.ts");
    await writeFile(consumerPath, 'readFileSync(`docs/archive/${name}.md`, "utf8");\n');
    await git(root, "add", "src/consumer.ts");
    const live = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(live.status, 1, live.stderr || live.stdout);
    assert.ok(
      JSON.parse(live.stdout).diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "content/forbidden-consumer" && item.path === "src/consumer.ts",
      ),
    );

    await writeFile(consumerPath, '// readFileSync("docs/archive/comment.md", "utf8");\n');
    await mkdir(join(root, "tests", "fixtures", "documentation-governance"), { recursive: true });
    await writeFile(
      join(root, "tests", "fixtures", "documentation-governance", "negative.ts"),
      'readFileSync("docs/archive/fixture.md", "utf8");\n',
    );
    await mkdir(join(root, "openspec", "changes", "migration", "evidence"), { recursive: true });
    await writeFile(
      join(root, "openspec", "changes", "migration", "evidence", "config.yaml"),
      "source: docs/archive/evidence.md\n",
    );
    await git(
      root,
      "add",
      "src/consumer.ts",
      "tests/fixtures/documentation-governance/negative.ts",
      "openspec/changes/migration/evidence/config.yaml",
    );
    const excluded = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(excluded.status, 0, excluded.stderr || excluded.stdout);
    assert.equal(
      JSON.parse(excluded.stdout).diagnostics.some(
        (item: { ruleId: string }) => item.ruleId === "content/forbidden-consumer",
      ),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("docs checker validates links, anchors, reachability, and reverse links", async () => {
  const root = await createRepository();
  try {
    const guidePath = join(root, "docs", "guide.md");
    const source = await readFile(guidePath, "utf8");
    await writeFile(guidePath, source.replace("[文档首页](README.md)", "没有上级入口。"));
    const reverse = runChecker(root, ["--format", "json"]);
    assert.equal(reverse.status, 1);
    const reverseRules = JSON.parse(reverse.stdout).diagnostics.map((item: { ruleId: string }) => item.ruleId);
    assert.ok(reverseRules.includes("navigation/reverse-link"));

    await writeFile(guidePath, source.replace("# 指南", "# 指南\n\n[错误锚点](#not-present)"));
    const anchor = runChecker(root, ["--format", "json"]);
    assert.equal(anchor.status, 1);
    assert.ok(JSON.parse(anchor.stdout).diagnostics.some((item: { ruleId: string }) => item.ruleId === "links/anchor-missing"));

    await mkdir(join(root, "docs", "orphan"), { recursive: true });
    await writeFile(join(root, "docs", "orphan", "README.md"), source.replace("# 指南", "# 孤立文档"));
    await git(root, "add", "docs/orphan/README.md");
    const orphan = runChecker(root, ["--format", "json"]);
    assert.equal(orphan.status, 1);
    assert.ok(JSON.parse(orphan.stdout).diagnostics.some((item: { ruleId: string }) => item.ruleId === "navigation/unreachable"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("full mode emits review warnings without a base and fast mode escalates safely", async () => {
  const root = await createRepository();
  try {
    const full = runChecker(root, ["--format", "json"]);
    assert.equal(full.status, 0, full.stderr || full.stdout);
    const fullPayload = JSON.parse(full.stdout);
    assert.ok(fullPayload.diagnostics.some((item: { ruleId: string }) => item.ruleId === "relationships/review"));

    const fast = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(fast.status, 0, fast.stderr || fast.stdout);
    assert.equal(JSON.parse(fast.stdout).effectiveMode, "fast");

    await writeFile(join(root, "docs", "_meta", "policy.yaml"), `${await readFile(join(root, "docs", "_meta", "policy.yaml"), "utf8")}\n`);
    const escalated = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(escalated.status, 0, escalated.stderr || escalated.stdout);
    assert.equal(JSON.parse(escalated.stdout).effectiveMode, "full");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fast impact closure excludes unrelated legacy errors, catches related errors, and escalates unsafe changes", async () => {
  const root = await createRepository();
  try {
    const unrelatedPath = join(root, "docs", "unrelated.md");
    await writeFile(unrelatedPath, "# Unrelated legacy document\n\n[missing](missing.md)\n");
    await git(root, "add", "docs/unrelated.md");
    await git(root, "commit", "--quiet", "-m", "add unrelated legacy baseline");

    const guidePath = join(root, "docs", "guide.md");
    const guide = await readFile(guidePath, "utf8");
    await writeFile(guidePath, `${guide}\n无害的详情变更。\n`);
    const bounded = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(bounded.status, 0, bounded.stderr || bounded.stdout);
    const boundedPayload = JSON.parse(bounded.stdout);
    assert.equal(boundedPayload.effectiveMode, "fast");
    assert.equal(
      boundedPayload.diagnostics.some((item: { path: string }) => item.path === "docs/unrelated.md"),
      false,
    );

    await writeFile(guidePath, `${guide}\n# English changed heading\n`);
    const languageViolation = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(languageViolation.status, 1, languageViolation.stderr || languageViolation.stdout);
    const languagePayload = JSON.parse(languageViolation.stdout);
    assert.equal(languagePayload.effectiveMode, "fast");
    assert.ok(
      languagePayload.diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "language/required-language" && item.path === "docs/guide.md",
      ),
    );
    assert.equal(
      languagePayload.diagnostics.some((item: { path: string }) => item.path === "docs/unrelated.md"),
      false,
    );

    await writeFile(guidePath, `${guide}\n[相关缺失目标](missing.md)\n`);
    const related = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(related.status, 1, related.stderr || related.stdout);
    const relatedPayload = JSON.parse(related.stdout);
    assert.equal(relatedPayload.effectiveMode, "fast");
    assert.ok(
      relatedPayload.diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "links/target-missing" && item.path === "docs/guide.md",
      ),
    );
    assert.equal(
      relatedPayload.diagnostics.some((item: { path: string }) => item.path === "docs/unrelated.md"),
      false,
    );

    await writeFile(guidePath, guide);
    const policyPath = join(root, "docs", "_meta", "policy.yaml");
    const policy = await readFile(policyPath, "utf8");
    await writeFile(policyPath, `${policy}\n`);
    const unsafe = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(unsafe.status, 1, unsafe.stderr || unsafe.stdout);
    const unsafePayload = JSON.parse(unsafe.stdout);
    assert.equal(unsafePayload.effectiveMode, "full");
    assert.ok(unsafePayload.escalationReasons.some((reason: string) => reason.includes("docs/_meta/policy.yaml")));
    assert.ok(unsafePayload.diagnostics.some((item: { path: string }) => item.path === "docs/unrelated.md"));

    await writeFile(policyPath, policy);
    await rm(guidePath);
    const deleted = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(deleted.status, 1, deleted.stderr || deleted.stdout);
    const deletedPayload = JSON.parse(deleted.stdout);
    assert.equal(deletedPayload.effectiveMode, "full");
    assert.ok(deletedPayload.escalationReasons.some((reason: string) => reason === "unsafe-d:docs/guide.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fast impact closure runs only relationship-selected verifier adapters", async () => {
  const root = await createRepository();
  try {
    const adapterPath = await addGeneratorAdapter(root, "impact-generator");
    await writeFile(adapterPath, "console.error('docs/guide.md is stale'); process.exitCode = 1;\n");
    await writeFile(join(root, "src", "unrelated.ts"), "export const unrelated = true;\n");
    await git(root, "add", "docs/_meta/policy.yaml", "scripts/docs/impact-generator.mjs", "src/unrelated.ts");
    await git(root, "commit", "--quiet", "-m", "add impact adapter baseline");

    const unrelatedPath = join(root, "src", "unrelated.ts");
    await writeFile(unrelatedPath, "export const unrelated = false;\n");
    const skipped = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(skipped.status, 0, skipped.stderr || skipped.stdout);
    assert.equal(JSON.parse(skipped.stdout).effectiveMode, "fast");
    assert.equal(
      JSON.parse(skipped.stdout).diagnostics.some((item: { ruleId: string }) => item.ruleId === "generator/impact-generator"),
      false,
    );

    await writeFile(unrelatedPath, "export const unrelated = true;\n");
    const sourcePath = join(root, "src", "example.ts");
    await writeFile(sourcePath, `${await readFile(sourcePath, "utf8")}\n`);
    const selected = runChecker(root, ["--mode", "fast", "--base", "HEAD", "--format", "json"]);
    assert.equal(selected.status, 1, selected.stderr || selected.stdout);
    const selectedPayload = JSON.parse(selected.stdout);
    assert.equal(selectedPayload.effectiveMode, "fast");
    assert.ok(
      selectedPayload.diagnostics.some(
        (item: { ruleId: string; path: string }) => item.ruleId === "generator/impact-generator" && item.path === "docs/guide.md",
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
