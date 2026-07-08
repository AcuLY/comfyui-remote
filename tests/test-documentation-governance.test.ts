import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

function listFiles(root: string, fileName: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(path, fileName));
      continue;
    }

    if (entry.name === fileName) {
      files.push(path);
    }
  }

  return files.sort();
}

function appRouteFromPage(path: string): string {
  const rel = path.replace(/^src\/app\//, "").replace(/\/page\.tsx$/, "");

  if (rel === "" || rel === "page.tsx") {
    return "/";
  }

  return `/${rel
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, ":$1*")
    .replace(/\[\.\.\.([^\]]+)\]/g, ":$1*")
    .replace(/\[([^\]]+)\]/g, ":$1")}`;
}

function apiRouteFromRouteFile(path: string): string {
  const rel = path.replace(/^src\/app\/api\//, "").replace(/\/route\.ts$/, "");

  return `/api/${rel
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, ":$1...")
    .replace(/\[\.\.\.([^\]]+)\]/g, ":$1...")
    .replace(/\[([^\]]+)\]/g, ":$1")}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("root docs declare their maintained role and point to the documentation map", () => {
  const readme = read(ROOT_DOCS.readme);
  const design = read(ROOT_DOCS.design);
  const claude = read(ROOT_DOCS.claude);
  const positionPresets = read(ROOT_DOCS.positionPresets);

  assert.match(readme, /分类：当前文档/, "README must declare its documentation class");
  assert.match(readme, /更新触发：/, "README must declare when it changes");
  assert.match(readme, /docs\/index\.md/, "README must point agents to the read-first index");
  assert.match(readme, /docs\/documentation-map\.md/, "README must point to the documentation map");
  assert.match(readme, /docs\/repo-inventory\.md/, "README must point to generated inventory");
  for (const maintainedSource of [
    ".env.example",
    "docs/local-verification.md",
    "docs/runbooks/config-runtime-assets.md",
    "docs/agent-api.md",
    "docs/api/README.md",
    "docs/workflow.api.json",
    "src/server/mcp/server.ts",
    "DESIGN.md",
    "docs/ui/README.md",
    "docs/prisma-provider-matrix.md",
    "docs/prisma-schema-compatibility.md",
    "docs/worker-boundaries.md",
    "AGENTS.md",
  ]) {
    assert.match(readme, new RegExp(maintainedSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `README must route ${maintainedSource} readers to the maintained source`);
  }

  for (const feature of ["生图", "训练", "审核", "导出", "Comfy 运行态", "Agent API", "MCP"]) {
    assert.match(readme, new RegExp(feature, "i"), `README feature map must mention ${feature}`);
  }
  for (const staleReadmeClaim of [
    /##\s*文档规则/,
    /Keep README stable/,
    /Do not add exact page inventories/,
    /Re-run `npx tsx scripts\/docs\/generate-repo-inventory\.ts`/,
    /7 个专为 AI Agent/,
    /6 个 Resources/,
    /\/settings\/workflows/,
    /\/settings\/templates/,
    /\/assets\/prompts/,
    /\|\s*回收站\s*\|\s*`\/trash`/,
    /IMAGE_BASE_DIR/,
    /AUTO_CENSOR_PYTHON_CMD`\s*\|\s*否\s*\|\s*`python3`/,
    /LOG_ENABLE_FILE/,
    /config\/workflows\/\*\.json/,
  ]) {
    assert.doesNotMatch(readme, staleReadmeClaim, `README must not keep stale claim ${staleReadmeClaim}`);
  }

  assert.match(design, /Classification: product\/design reference/);
  assert.match(design, /root-level file is intentional/);
  assert.match(design, /src\/components\/design-demo-shell\/app-shell\.module\.css/);
  assert.match(design, /src\/components\/design-demo-ui\/primitives\/\*\*/);
  assert.doesNotMatch(design, /implementation inventory/i);

  assert.match(claude, /AGENTS\.md is the source of truth/);
  assert.match(positionPresets, /Classification: active product prompt reference/);
});

test("README current route and MCP facts match source", () => {
  const readme = read(ROOT_DOCS.readme);
  const routeFiles = listFiles("src/app/api", "route.ts");
  const pageRoutes = listFiles("src/app", "page.tsx").map(appRouteFromPage);
  const mcpSource = read("src/server/mcp/server.ts");

  const apiEndpoints = routeFiles.flatMap((path) => {
    const methods = [...read(path).matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]);
    return methods.map((method) => ({ method, route: apiRouteFromRouteFile(path) }));
  });
  const countByPrefix = (predicate: (route: string) => boolean) =>
    apiEndpoints.filter(({ route }) => predicate(route)).length;
  const agentEndpoints = apiEndpoints.filter(({ route }) => route.startsWith("/api/agent/"));
  const toolNames = [...mcpSource.matchAll(/server\.tool\(\s*"([^"]+)"/g)].map((match) => match[1]);
  const resourceUris = [...mcpSource.matchAll(/new ResourceTemplate\("([^"]+)"/g)].map((match) => match[1]);

  assert.match(readme, new RegExp(`当前源码里有 ${pageRoutes.length} 个 .*page\\.tsx`));
  assert.match(readme, new RegExp(`当前源码里有 ${routeFiles.length} 个 .*route\\.ts`));
  assert.match(readme, new RegExp(`导出 ${apiEndpoints.length} 个 HTTP 方法入口`));

  for (const route of [
    "/",
    "/queue/:runId",
    "/projects/:projectId/sections/:sectionId/results",
    "/assets/templates/:templateId/sections/:sectionIndex",
    "/training/:route*",
    "/design-demos/:route*",
  ]) {
    assert.ok(pageRoutes.includes(route), `${route} must be present in source page routes`);
    assert.match(readme, new RegExp(escapeRegExp(route)), `${route} must be listed in README page overview`);
  }

  const areaCounts = [
    ["`/api/agent/**`", countByPrefix((route) => route.startsWith("/api/agent/"))],
    ["`/api/training/**`", countByPrefix((route) => route.startsWith("/api/training/"))],
    ["`/api/preset-library/**`", countByPrefix((route) => route.startsWith("/api/preset-library/"))],
    ["`/api/queue/**` / `/api/queue-data`", countByPrefix((route) => route.startsWith("/api/queue"))],
  ] as const;
  for (const [label, count] of areaCounts) {
    assert.match(readme, new RegExp(`${escapeRegExp(label)}\\s*\\|\\s*${count}\\s*\\|`), `${label} count must match source`);
  }

  assert.match(readme, new RegExp(`/api/agent/\\*\\*.*${agentEndpoints.length} 个 HTTP 方法入口`, "s"));
  for (const { method, route } of agentEndpoints) {
    assert.match(readme, new RegExp(`\\|\\s*\\\`${method}\\\`\\s*\\|\\s*\\\`${escapeRegExp(route)}\\\``), `${method} ${route} must be documented in README`);
  }

  assert.match(readme, new RegExp(`当前 MCP 注册 ${toolNames.length} 个 tools`));
  for (const toolName of toolNames) {
    assert.match(readme, new RegExp(`\\\`${toolName}\\\``), `${toolName} must be listed in README`);
  }

  assert.match(readme, new RegExp(`当前 MCP 注册 ${resourceUris.length} 个 resources`));
  for (const uri of resourceUris) {
    assert.match(readme, new RegExp(`\\\`${escapeRegExp(uri)}\\\``), `${uri} must be listed in README`);
  }
});

test("agent API docs stay synchronized with MCP registry and current trash surface", () => {
  const agentApi = read("docs/agent-api.md");
  const mcpSource = read("src/server/mcp/server.ts");

  for (const toolName of [
    "list_projects",
    "update_project",
    "update_project_section",
    "run_all_sections",
    "run_section",
    "review_images",
    "list_prompt_blocks",
    "add_prompt_block",
    "update_prompt_block",
    "remove_prompt_block",
    "reorder_prompt_blocks",
  ]) {
    assert.match(mcpSource, new RegExp(`"${toolName}"`), `${toolName} must remain registered in MCP source`);
    assert.match(agentApi, new RegExp(`\\\`${toolName}\\\``), `${toolName} must be documented in agent API docs`);
  }

  for (const resourceUri of [
    "comfyui://projects/{projectId}/context",
    "comfyui://runs/{runId}/context",
    "comfyui://sections/{sectionId}/blocks",
  ]) {
    assert.match(mcpSource, new RegExp(resourceUri.replace(/[{}]/g, "\\$&")));
    assert.match(agentApi, new RegExp(resourceUri.replace(/[{}]/g, "\\$&")));
  }

  assert.doesNotMatch(agentApi, /GET`\s*\|\s*`\/api\/trash`/, "trash is no longer a standalone API route");
  assert.match(agentApi, /\/api\/queue-data\?includeTrash=1/, "trash listing must route through queue-data refresh");
  assert.doesNotMatch(mcpSource, /resources to read detailed context for projects, runs, workflows, and prompt blocks/);
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
