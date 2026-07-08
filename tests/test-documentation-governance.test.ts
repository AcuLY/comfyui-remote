import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const ROOT_DOCS = {
  readme: "README.md",
  design: "DESIGN.md",
  claude: "CLAUDE.md",
  agents: "AGENTS.md",
  positionPresets: "position_presets.md",
} as const;

const DOCUMENTATION_MAP_PATH = "docs/documentation-map.md";
const DOC_INDEX_PATH = "docs/index.md";
const RETAINED_CONTEXT_DOCS = [
  "docs/archive/historical/handoff.md",
  "docs/archive/historical/development-progress.md",
  "docs/archive/historical/development-todo.md",
  "docs/archive/historical/integration-test-plan.md",
  "docs/archive/design-system/DESIGN_SYSTEM_SUMMARY.md",
  "docs/archive/design-system/design-system-migration.md",
  "docs/archive/design-system/shadcn-design-guide.md",
  "docs/design-v0.1.md",
  "docs/design-v0.3-workflow-integration.md",
  "docs/quick-reference.md",
  "docs/WORKFLOW_QUICK_REFERENCE.md",
  "docs/WORKFLOW_SYSTEM_ANALYSIS.md",
  "docs/analysis_comprehensive.md",
] as const;

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, "utf8");
}

test("root docs declare their maintained role and point to the documentation map", () => {
  const readme = read(ROOT_DOCS.readme);
  const design = read(ROOT_DOCS.design);
  const claude = read(ROOT_DOCS.claude);
  const positionPresets = read(ROOT_DOCS.positionPresets);

  assert.match(readme, /docs\/index\.md/, "README must point agents to the read-first index");
  assert.match(readme, /docs\/documentation-map\.md/, "README must point to the documentation map");
  assert.match(readme, /docs\/repo-inventory\.md/, "README must point to generated inventory");

  for (const feature of ["generation", "training", "review", "export", "Comfy runtime", "Agent API", "MCP"]) {
    assert.match(readme, new RegExp(feature, "i"), `README feature map must mention ${feature}`);
  }

  assert.match(design, /Classification: product\/design reference/);
  assert.doesNotMatch(design, /implementation inventory/i);

  assert.match(claude, /AGENTS\.md is the source of truth/);
  assert.match(positionPresets, /Classification: active product prompt reference/);
});

test("documentation map defines the maintained layers and classifies root docs", () => {
  const documentationMap = read(DOCUMENTATION_MAP_PATH);

  for (const layer of [
    "README.md",
    "docs/architecture/",
    "docs/runbooks/",
    "docs/api/",
    "docs/ui/",
    "docs/testing/",
    "docs/archive/",
    "docs/superpowers/plans/",
  ]) {
    assert.match(documentationMap, new RegExp(layer.replaceAll("/", "\\/")), `${layer} must be mapped`);
  }

  for (const classification of [
    "current",
    "runbook",
    "architecture reference",
    "API contract",
    "product/design reference",
    "testing reference",
    "historical record",
    "generated artifact",
    "superseded",
  ]) {
    assert.match(documentationMap, new RegExp(classification, "i"), `${classification} must be documented`);
  }

  for (const authority of [
    "README vs handoff",
    "design docs vs frontend guides",
    "workflow quick references vs API JSON",
    "local verification vs deploy rules",
  ]) {
    assert.match(documentationMap, new RegExp(authority, "i"), `${authority} must have an authority decision`);
  }
});

test("documentation layer README files exist for current target directories", () => {
  for (const path of [
    "docs/architecture/README.md",
    "docs/runbooks/README.md",
    "docs/api/README.md",
    "docs/ui/README.md",
    "docs/testing/README.md",
    "docs/archive/README.md",
  ]) {
    const source = read(path);
    assert.match(source, /Classification:/, `${path} must declare its documentation class`);
    assert.match(source, /Update trigger:/, `${path} must declare when it changes`);
  }
});

test("agent rule entrypoint stays synchronized with source rule files", () => {
  const agents = read(ROOT_DOCS.agents);
  const index = read(DOC_INDEX_PATH);

  assert.match(agents, /manual synchronization/i);
  assert.match(agents, /workflow changes/i);
  assert.match(agents, /agent-rules\/\*\*/);
  assert.match(agents, /rendered AGENTS\.md summary/i);

  assert.match(index, /testing/i, "documentation index must include test documentation");
  assert.match(index, /docs\/documentation-map\.md/);
});

test("agent rule files keep deploy, dev-service, and mypc concerns separate", () => {
  const deployIndex = read("agent-rules/deploy/index.md");
  const devService = read("agent-rules/dev-service.md");
  const mypcPowerShell = read("agent-rules/mypc-powershell.md");

  for (const deployRule of [
    "agent-rules/deploy/lock.md",
    "agent-rules/deploy/queue.md",
    "agent-rules/deploy/prisma.md",
    "agent-rules/deploy/next-build.md",
    "agent-rules/deploy/service-restart.md",
    "agent-rules/deploy/verification.md",
  ]) {
    assert.ok(existsSync(deployRule), `${deployRule} must remain a separate deploy rule`);
    assert.match(deployIndex, new RegExp(deployRule.replace("agent-rules/deploy/", "")));
  }

  assert.match(devService, /Pure dev-service work is not a full deployment/);
  assert.match(devService, /does not require `\.deploy\.lock`/);
  assert.match(devService, /Do not upgrade dev-service verification into public production verification/);

  assert.match(mypcPowerShell, /EncodedCommand/);
  assert.match(mypcPowerShell, /UTF-16LE/);
  assert.match(mypcPowerShell, /ssh mypc powershell -NoProfile -EncodedCommand/);
});

test("retained context docs declare current replacement sources", () => {
  for (const path of RETAINED_CONTEXT_DOCS) {
    const source = read(path);

    assert.match(source, /Classification:/, `${path} must declare classification`);
    assert.match(source, /Current source:/, `${path} must name current source of truth`);
    assert.match(source, /docs\/index\.md/, `${path} must route readers through the read-first index`);
  }
});

test("local verification runbook covers auth, service modes, ComfyUI, and protected pages", () => {
  const localVerification = read("docs/local-verification.md");

  for (const requiredText of [
    "Classification: runbook",
    "Update trigger:",
    ".env",
    "/api/auth/verify",
    "protected pages",
    "npm run dev",
    "next dev",
    "next start",
    "COMFY_API_URL",
    "ComfyUI",
  ]) {
    assert.match(localVerification, new RegExp(requiredText.replaceAll("/", "\\/")), `local verification must mention ${requiredText}`);
  }
});
