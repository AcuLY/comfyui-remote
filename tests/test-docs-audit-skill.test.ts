import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SKILL_ROOT = ".codex/skills/docs-audit";

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("docs-audit package stays minimal and explicit-only", () => {
  assert.deepEqual(readdirSync(SKILL_ROOT).sort(), ["SKILL.md", "agents", "references"]);
  assert.deepEqual(readdirSync(join(SKILL_ROOT, "agents")).sort(), ["openai.yaml"]);
  assert.deepEqual(readdirSync(join(SKILL_ROOT, "references")).sort(), ["evidence-contract.md"]);

  const skill = read(join(SKILL_ROOT, "SKILL.md"));
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(frontmatter, "SKILL.md must have YAML frontmatter");
  const frontmatterKeys = [...frontmatter[1].matchAll(/^([a-zA-Z][\w-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(frontmatterKeys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: docs-audit$/m);
  assert.match(frontmatter[1], /explicitly invokes \$docs-audit/i);
  assert.match(skill, /Do not\s+infer invocation from ordinary source edits/i);
  assert.match(skill, /Do not schedule or recur/i);

  const openai = read(join(SKILL_ROOT, "agents/openai.yaml"));
  assert.match(openai, /display_name: "Documentation Audit"/);
  assert.match(openai, /short_description: "Audit documentation against repository evidence"/);
  assert.match(openai, /default_prompt: "Use \$docs-audit to audit the requested documentation scope and report evidence-backed findings\."/);
  assert.match(openai, /allow_implicit_invocation: false/);
});

test("docs-audit declares every scope and operation boundary", () => {
  const skill = read(join(SKILL_ROOT, "SKILL.md"));

  for (const scope of ["changed", "paths <repo-relative paths...>", "change <openspec-id>", "full"]) {
    assert.match(skill, new RegExp("`" + escapeRegExp(scope) + "`"), `missing ${scope} scope`);
  }
  assert.match(skill, /If the explicit invocation omits scope[\s\S]*choose `changed`[\s\S]*otherwise use `full`/);
  assert.match(skill, /`report` is the default and writes nothing/);
  assert.match(skill, /`record <repo-relative-evidence-path>`[\s\S]*never edits audited documents/);
  assert.match(skill, /`fix <explicitly-user-authorized-paths\.\.\.>`[\s\S]*only paths the user explicitly authorized/);
  assert.match(skill, /An OpenSpec task alone does not broaden fix authorization/);
});

test("docs-audit constrains writes and refuses self-signoff", () => {
  const skill = read(join(SKILL_ROOT, "SKILL.md"));

  assert.match(skill, /Reject absolute paths, traversal/);
  assert.match(skill, /openspec\/changes\/<current-change-id>\/evidence\/docs-audit\//);
  assert.match(skill, /Require the change ID to match the\s+approved task/);
  assert.match(skill, /Capture the complete pre-existing tracked, staged, and untracked worktree state/);
  assert.match(skill, /Run `npm run docs:check`/);
  assert.match(skill, /Rerun verification after a fix/);
  assert.match(skill, /Never sign off your own semantic correction/);
  assert.match(skill, /leave the result `review-required`/);
  assert.match(skill, /Do not write an audit record during `fix` unless/);
});

test("evidence contract separates current target and history and closes every finding", () => {
  const skill = read(join(SKILL_ROOT, "SKILL.md"));
  assert.match(skill, /\[references\/evidence-contract\.md\]\(references\/evidence-contract\.md\)/);

  const contract = read(join(SKILL_ROOT, "references/evidence-contract.md"));
  assert.match(contract, /Current implementation/);
  assert.match(contract, /Approved target/);
  assert.match(contract, /Historical intent/);
  assert.match(contract, /never promote it directly to current truth/i);

  for (const field of ["claimCategory", "owner", "evidence", "conflict", "confidence", "action", "resolution", "verification"]) {
    assert.match(contract, new RegExp("`" + escapeRegExp(field) + "`"), `finding schema must include ${field}`);
  }
  for (const action of ["keep", "rewrite", "move", "split", "merge", "extract-delete", "delete", "user-decision-required"]) {
    assert.match(contract, new RegExp("`" + escapeRegExp(action) + "`"), `missing ${action} action`);
  }
  for (const resolution of ["fixed", "accepted-current", "historical-only", "duplicate-removed", "deferred-to-openspec", "review-required"]) {
    assert.match(contract, new RegExp("`" + escapeRegExp(resolution) + "`"), `missing ${resolution} resolution`);
  }
  assert.match(contract, /product direction/);
  assert.match(contract, /unavailable required runtime evidence/);
  assert.match(contract, /fixing agent must never/i);
});

test("baseline evidence covers the uncontrolled pre-skill scenarios", () => {
  const baseline = read("openspec/changes/rebuild-documentation-governance/evidence/docs-audit-skill-baseline.md");

  for (const scenario of [
    "B1-current-target-history",
    "B2-missing-runtime-proof",
    "B3-duplicate-authority",
    "B4-unsafe-operations",
    "B5-fix-authorization",
    "B6-self-review",
  ]) {
    assert.match(baseline, new RegExp(scenario), `baseline must include ${scenario}`);
  }
  assert.match(baseline, /not in `HEAD`/);
  assert.match(baseline, /No fresh-agent behavioral result is claimed/);
});
