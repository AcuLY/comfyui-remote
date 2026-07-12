import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const VALIDATOR = join(ROOT, "scripts", "skills", "validate.mjs");
const FIXTURE = join(ROOT, "tests", "fixtures", "documentation-governance", "skills", "docs-audit");

async function createSkillRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "skills-check-"));
  const skill = join(root, ".codex", "skills", "docs-audit");
  await mkdir(join(root, ".codex", "skills"), { recursive: true });
  await cp(FIXTURE, skill, { recursive: true });
  return root;
}

function run(root: string, args = [".codex/skills/docs-audit", "--json"]) {
  return spawnSync(process.execPath, [VALIDATOR, ...args], { cwd: root, encoding: "utf8" });
}

test("repository Skill validator accepts a contained explicit-only docs-audit package", async () => {
  const root = await createSkillRoot();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.deepEqual(payload.summary, { errors: 0, warnings: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository Skill validator accepts a Chinese explicit-invocation description", async () => {
  const root = await createSkillRoot();
  try {
    const skillPath = join(root, ".codex", "skills", "docs-audit", "SKILL.md");
    await writeFile(
      skillPath,
      (await readFile(skillPath, "utf8")).replace(
        "Explicitly audit repository documentation only when the user or an approved OpenSpec task invokes $docs-audit.",
        "仅在用户或已批准 OpenSpec 任务显式调用 $docs-audit 时审计仓库文档。",
      ),
    );
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout).summary, { errors: 0, warnings: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository Skill validator reports broken and escaping bundled references", async () => {
  const root = await createSkillRoot();
  try {
    const skillPath = join(root, ".codex", "skills", "docs-audit", "SKILL.md");
    await writeFile(skillPath, `${await readFile(skillPath, "utf8")}\n[missing](references/missing.md)\n[escape](../../../outside.md)\n`);
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const rules = JSON.parse(result.stdout).diagnostics.map((item: { ruleId: string }) => item.ruleId);
    assert.ok(rules.includes("skill/reference-missing"));
    assert.ok(rules.includes("skill/path-escape"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("docs-audit requires matching name and disabled implicit invocation", async () => {
  const root = await createSkillRoot();
  try {
    const skillPath = join(root, ".codex", "skills", "docs-audit", "SKILL.md");
    await writeFile(skillPath, (await readFile(skillPath, "utf8")).replace("name: docs-audit", "name: other-name"));
    const openaiPath = join(root, ".codex", "skills", "docs-audit", "agents", "openai.yaml");
    await writeFile(openaiPath, (await readFile(openaiPath, "utf8")).replace("allow_implicit_invocation: false", "allow_implicit_invocation: true"));
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const rules = JSON.parse(result.stdout).diagnostics.map((item: { ruleId: string }) => item.ruleId);
    assert.ok(rules.includes("skill/name-folder-mismatch"));
    assert.ok(rules.includes("skill/implicit-invocation"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Skill validator reserves exit 2 for invocation and tool failures", () => {
  const result = spawnSync(process.execPath, [VALIDATOR, "--json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).exitCode, 2);
});
