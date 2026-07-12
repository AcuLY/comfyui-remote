import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import yaml from "js-yaml";

const WORKFLOW_PATH = ".github/workflows/documentation-governance.yml";

test("documentation CI is unfiltered, comparison-based, and non-writing", () => {
  const source = readFileSync(WORKFLOW_PATH, "utf8");
  const workflow = yaml.load(source) as {
    on: Record<string, unknown>;
    jobs: Record<string, {
      "runs-on": string;
      steps: Array<{ uses?: string; with?: Record<string, unknown>; run?: string; env?: Record<string, string> }>;
    }>;
  };

  assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "push"]);
  assert.doesNotMatch(source, /^\s*paths(?:-ignore)?:/m);

  const job = workflow.jobs["documentation-governance"];
  assert.equal(job["runs-on"], "windows-latest");
  assert.ok(job.steps.some((step) =>
    step.uses === "actions/checkout@v4" && step.with?.["fetch-depth"] === 0));
  assert.ok(job.steps.some((step) =>
    step.uses === "actions/setup-node@v4" && step.with?.["node-version"] === "20.19"));
  assert.ok(job.steps.some((step) => step.run === "npm ci"));

  const commands = job.steps.map((step) => step.run ?? "").join("\n");
  assert.match(commands, /tests\/test-docs-check-language\.test\.ts/);
  assert.match(commands, /npm run docs:check -- --mode full --base \$base/);
  assert.match(commands, /git diff --exit-code/);
  assert.match(commands, /git status --porcelain=v1 --untracked-files=all/);
  assert.ok(job.steps.some((step) => step.env?.DOCS_COMPARISON_BASE?.includes("pull_request.base.sha")));
});
