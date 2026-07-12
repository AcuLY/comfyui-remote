import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SKILL_ROOT = ".codex/skills/docs-audit";

function read(path: string): string {
  assert.ok(existsSync(path), `${path} 必须存在`);
  return readFileSync(path, "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("docs-audit 包保持最小结构且只能显式调用", () => {
  assert.deepEqual(readdirSync(SKILL_ROOT).sort(), ["SKILL.md", "agents", "references"]);
  assert.deepEqual(readdirSync(join(SKILL_ROOT, "agents")).sort(), ["openai.yaml"]);
  assert.deepEqual(readdirSync(join(SKILL_ROOT, "references")).sort(), ["evidence-contract.md"]);

  const skill = read(join(SKILL_ROOT, "SKILL.md"));
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(frontmatter, "SKILL.md 必须包含 YAML frontmatter");
  const frontmatterKeys = [...frontmatter[1].matchAll(/^([a-zA-Z][\w-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(frontmatterKeys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: docs-audit$/m);
  assert.match(frontmatter[1], /显式调用 \$docs-audit/);
  assert.match(skill, /不得从普通源码编辑[\s\S]*推断调用/);
  assert.match(skill, /不得安排定时或重复运行/);

  const openai = read(join(SKILL_ROOT, "agents/openai.yaml"));
  assert.match(openai, /display_name: "文档审计"/);
  assert.match(openai, /short_description: "根据当前仓库证据审计文档语义、所有权与权威边界问题"/);
  assert.match(openai, /default_prompt: "使用 \$docs-audit 审计指定文档范围，并报告有证据支持的 finding。"/);
  assert.match(openai, /allow_implicit_invocation: false/);
});

test("docs-audit 声明全部 scope 与 operation 边界", () => {
  const skill = read(join(SKILL_ROOT, "SKILL.md"));

  for (const scope of ["changed", "paths <repo-relative paths...>", "change <openspec-id>", "full"]) {
    assert.match(skill, new RegExp("`" + escapeRegExp(scope) + "`"), `缺少 ${scope} scope`);
  }
  assert.match(skill, /显式调用省略范围时[\s\S]*才选择 `changed`[\s\S]*否则使用 `full`/);
  assert.match(skill, /`report` 是默认操作，不写入任何内容/);
  assert.match(skill, /`record <repo-relative-evidence-path>`[\s\S]*绝不编辑被审计文档/);
  assert.match(skill, /`fix <explicitly-user-authorized-paths\.\.\.>`[\s\S]*只能编辑用户[\s\S]*显式授权的路径/);
  assert.match(skill, /OpenSpec 任务本身不会扩大 fix 授权/);
});

test("docs-audit 限制写入并拒绝自我签署", () => {
  const skill = read(join(SKILL_ROOT, "SKILL.md"));

  assert.match(skill, /拒绝绝对路径、路径穿越/);
  assert.match(skill, /openspec\/changes\/<current-change-id>\/evidence\/docs-audit\//);
  assert.match(skill, /要求 change ID 与已批准任务匹配/);
  assert.match(skill, /采集完整既有 tracked、staged 和 untracked worktree 状态/);
  assert.match(skill, /运行 `npm run docs:check`/);
  assert.match(skill, /fix 后重新验证/);
  assert.match(skill, /绝不签署自己的语义修正/);
  assert.match(skill, /结果保持 `review-required`/);
  assert.match(skill, /`fix` 期间不得写 audit record/);
});

test("证据合同分离当前、目标与历史，并关闭每个 finding", () => {
  const skill = read(join(SKILL_ROOT, "SKILL.md"));
  assert.match(skill, /\[证据合同\]\(references\/evidence-contract\.md\)/);

  const contract = read(join(SKILL_ROOT, "references/evidence-contract.md"));
  assert.match(contract, /当前实现/);
  assert.match(contract, /已批准目标/);
  assert.match(contract, /历史意图/);
  assert.match(contract, /绝不能直接提升为当前事实/);

  for (const field of ["claimCategory", "owner", "evidence", "conflict", "confidence", "action", "resolution", "verification"]) {
    assert.match(contract, new RegExp("`" + escapeRegExp(field) + "`"), `finding schema 必须包含 ${field}`);
  }
  for (const action of ["keep", "rewrite", "move", "split", "merge", "extract-delete", "delete", "user-decision-required"]) {
    assert.match(contract, new RegExp("`" + escapeRegExp(action) + "`"), `缺少 ${action} action`);
  }
  for (const resolution of ["fixed", "accepted-current", "historical-only", "duplicate-removed", "deferred-to-openspec", "review-required"]) {
    assert.match(contract, new RegExp("`" + escapeRegExp(resolution) + "`"), `缺少 ${resolution} resolution`);
  }
  assert.match(contract, /产品方向/);
  assert.match(contract, /不可用的必要 runtime evidence/);
  assert.match(contract, /Fixer 绝不能自行/);
});

test("基线 evidence 覆盖 Skill 引入前的不受控场景", () => {
  const baseline = read("openspec/changes/rebuild-documentation-governance/evidence/docs-audit-skill-baseline.md");

  for (const scenario of [
    "B1-current-target-history",
    "B2-missing-runtime-proof",
    "B3-duplicate-authority",
    "B4-unsafe-operations",
    "B5-fix-authorization",
    "B6-self-review",
  ]) {
    assert.match(baseline, new RegExp(scenario), `基线必须包含 ${scenario}`);
  }
  assert.match(baseline, /不在 `HEAD` 中/);
  assert.match(baseline, /本基线不声称全新 Agent 行为结果/);
});
