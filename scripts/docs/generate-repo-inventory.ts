import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const INVENTORY_PATH = "docs/repo-inventory.md";

const INVENTORY_ARTIFACTS = [
  INVENTORY_PATH,
  "docs/index.md",
  "scripts/docs/generate-repo-inventory.ts",
  "tests/test-repo-inventory.test.ts",
];

const ACTIONS = {
  keep: "keep",
  move: "move",
  split: "split",
  rename: "rename",
  regenerate: "regenerate",
  archive: "archive",
  delete: "delete",
  documentOnly: "document-only",
} as const;

type InventoryRow = {
  path: string;
  area: string;
  ownerModule: string;
  fileType: string;
  currentRole: string;
  targetRole: string;
  action: (typeof ACTIONS)[keyof typeof ACTIONS];
};

function gitTrackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}

function allInventoryPaths(): string[] {
  return [...new Set([...gitTrackedFiles(), ...INVENTORY_ARTIFACTS])].sort((a, b) => a.localeCompare(b));
}

function getArea(path: string): string {
  if (!path.includes("/")) return "root";
  if (path.startsWith(".claude/")) return ".claude";
  if (path.startsWith(".codebuddy/skills/")) return ".codebuddy/skills";
  if (path.startsWith(".codebuddy/")) return ".codebuddy";
  if (path.startsWith(".codex/skills/")) return ".codex/skills";
  if (path.startsWith(".codex/")) return ".codex";
  if (path.startsWith("agent-rules/deploy/")) return "agent-rules/deploy";
  if (path.startsWith("agent-rules/")) return "agent-rules";
  if (path.startsWith("config/")) return "config";
  if (path.startsWith("design-demos/")) return "design-demos";
  if (path.startsWith("docs/prototypes/")) return "docs/prototypes";
  if (path.startsWith("docs/prd/")) return "docs/prd";
  if (path.startsWith("docs/plans/auto-review-analysis/")) return "docs/plans/auto-review-analysis";
  if (path.startsWith("docs/plans/")) return "docs/plans";
  if (path.startsWith("docs/superpowers/")) return "docs/superpowers";
  if (path.startsWith("docs/analysis/")) return "docs/analysis";
  if (path.startsWith("docs/")) return "docs";
  if (path.startsWith("prisma/migrations-sqlite/")) return "prisma/migrations-sqlite";
  if (path.startsWith("prisma/migrations/")) return "prisma/migrations";
  if (path.startsWith("prisma/")) return "prisma";
  if (path.startsWith("public/")) return "public";
  if (path.startsWith("scripts/db/")) return "scripts/db";
  if (path.startsWith("scripts/quality/")) return "scripts/quality";
  if (path.startsWith("scripts/training/")) return "scripts/training";
  if (path.startsWith("scripts/docs/")) return "scripts/docs";
  if (path.startsWith("scripts/")) return "scripts";
  if (path.startsWith("src/app/api/agent/")) return "src/app/api/agent";
  if (path.startsWith("src/app/api/training/")) return "src/app/api/training";
  if (path.startsWith("src/app/api/queue") || path.startsWith("src/app/api/worker/")) return "src/app/api/queue-worker";
  if (path.startsWith("src/app/api/comfy/")) return "src/app/api/comfy";
  if (path.startsWith("src/app/api/")) return "src/app/api";
  if (path.startsWith("src/app/design-demos/")) return "src/app/design-demos";
  if (path.startsWith("src/app/training/")) return "src/app/training";
  if (path.startsWith("src/app/")) return "src/app";
  if (path.startsWith("src/components/design-demo")) return "src/components/design-demo";
  if (path.startsWith("src/components/ui/")) return "src/components/ui";
  if (path.startsWith("src/components/")) return "src/components";
  if (path.startsWith("src/features/training/")) return "src/features/training";
  if (path.startsWith("src/features/")) return "src/features";
  if (path.startsWith("src/generated/")) return "src/generated";
  if (path.startsWith("src/hooks/")) return "src/hooks";
  if (path.startsWith("src/lib/actions/")) return "src/lib/actions";
  if (path.startsWith("src/lib/training/")) return "src/lib/training";
  if (path.startsWith("src/lib/")) return "src/lib";
  if (path.startsWith("src/server/repositories/training/")) return "src/server/repositories/training";
  if (path.startsWith("src/server/repositories/")) return "src/server/repositories";
  if (path.startsWith("src/server/services/training/")) return "src/server/services/training";
  if (path.startsWith("src/server/services/")) return "src/server/services";
  if (path.startsWith("src/server/http/")) return "src/server/http";
  if (path.startsWith("src/server/worker/")) return "src/server/worker";
  if (path.startsWith("src/server/quality/")) return "src/server/quality";
  if (path.startsWith("src/server/mcp/")) return "src/server/mcp";
  if (path.startsWith("src/server/")) return "src/server";
  if (path.startsWith("src/scripts/")) return "src/scripts";
  if (path.startsWith("tests/")) return "tests";
  return path.split("/").slice(0, 2).join("/");
}

function getOwnerModule(path: string, area: string): string {
  if (area === ".claude" || area === ".codebuddy" || area === ".codex") return "agent-tooling";
  if (area === ".codebuddy/skills" || area === ".codex/skills") return "agent-skills";
  if (path === "AGENTS.md" || path === "CLAUDE.md" || area.startsWith("agent-rules")) return "agent-workflow";
  if (path === "README.md" || path === "package.json" || path === "package-lock.json") return "root-project";
  if (path === "DESIGN.md" || path.includes("design") || path.includes("shadcn")) return "ui-design-system";
  if (path === "docs/index.md" || path === INVENTORY_PATH || area === "scripts/docs") return "documentation-system";
  if (path === "docs/agent-api.md" || path === "docs/workflow.api.json" || area === "src/app/api/agent" || area === "src/server/mcp") return "agent-api";
  if (path.includes("training") || area.includes("training")) return "training";
  if (path.includes("queue") || path.includes("worker") || area.includes("queue-worker")) return "queue-worker";
  if (path.includes("comfy")) return "comfy-runtime";
  if (path.includes("preset")) return "preset-library";
  if (path.includes("template")) return "template-library";
  if (path.includes("project")) return "generation-projects";
  if (path.includes("lora") || path.includes("model")) return "asset-library";
  if (path.includes("censor")) return "censoring";
  if (path.includes("review") || path.includes("image")) return "review-images";
  if (area.startsWith("docs/prd")) return "product-intent";
  if (area.startsWith("docs/plans/auto-review-analysis") || area === "scripts/quality" || area === "src/server/quality") return "quality-pipeline";
  if (area.startsWith("docs/plans") || area.startsWith("docs/superpowers")) return "execution-plans";
  if (area.startsWith("docs/prototypes")) return "training-prototype";
  if (area.startsWith("docs/analysis")) return "architecture-analysis";
  if (area === "docs" || path.endsWith(".md")) return "documentation-system";
  if (area.startsWith("prisma") || area === "scripts/db" || path.includes("db")) return "data-model";
  if (area === "config") return "runtime-config";
  if (area === "public") return "public-assets";
  if (area.startsWith("design-demos") || area.includes("design-demos")) return "design-demo";
  if (area === "src/components/ui") return "ui-primitives";
  if (area.startsWith("src/components")) return "shared-ui";
  if (area.startsWith("src/app/api")) return "api-routes";
  if (area.startsWith("src/app")) return "app-routes";
  if (area.startsWith("src/server/repositories")) return "repositories";
  if (area.startsWith("src/server/services")) return "services";
  if (area === "src/server/http") return "server-http";
  if (area === "src/hooks") return "shared-hooks";
  if (path === "src/proxy.ts" || path.startsWith("src/instrumentation")) return "next-runtime";
  if (area === "src/scripts") return "seed-scripts";
  if (area === "src/server" && path.includes("prompt-config")) return "prompt-config";
  if (area.startsWith("src/lib/actions")) return "server-actions";
  if (area.startsWith("src/lib")) return "shared-lib";
  if (area === "src/generated") return "generated-prisma";
  if (area === "tests") return "test-suite";
  if (area.startsWith("scripts")) return "maintenance-scripts";
  if (area === "root") return "root-config";
  return "supporting-files";
}

function getFileType(path: string, area: string): string {
  if (path.startsWith("src/generated/")) return "generated code";
  if (path.endsWith(".test.ts") || path.endsWith(".test.tsx") || path.endsWith(".test.mjs") || path.startsWith("tests/")) return "test";
  if (path.endsWith(".md")) return "doc";
  if (path.endsWith(".json") && area.startsWith("docs/plans/auto-review-analysis")) return "analysis data";
  if (path.endsWith(".csv")) return "analysis data";
  if (path.endsWith(".prisma")) return "schema";
  if (path.includes("/migrations/") || path.includes("/migrations-sqlite/") || path.endsWith(".sql")) return "migration";
  if (path.endsWith(".py") || path.endsWith(".mjs") || path.endsWith(".bat") || area.startsWith("scripts")) return "script";
  if (path.endsWith(".html") || (area.includes("prototypes") && (path.endsWith(".css") || path.endsWith(".js")))) return "prototype";
  if (path.match(/\.(svg|png|jpg|jpeg|webp|gif|ico)$/)) return "public asset";
  if (path.match(/\.(css|scss)$/)) return "style";
  if (path.match(/\.(json|mjs|ts|tsx|js)$/) && area === "root") return "config";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "source";
  return "support file";
}

function getDocClassification(path: string): string {
  if (path === "docs/index.md") return "current documentation index";
  if (path === INVENTORY_PATH) return "generated artifact";
  if (path === "docs/agent-api.md" || path === "docs/workflow.api.json") return "API contract";
  if (path === "docs/local-verification.md" || path.includes("QUICK_REFERENCE") || path.includes("quick-reference")) return "runbook";
  if (path.includes("DESIGN") || path.includes("design") || path.includes("shadcn")) return "product/design reference";
  if (path.startsWith("docs/prototypes/")) return "prototype";
  if (path.startsWith("docs/prd/")) return "product intent";
  if (path.startsWith("docs/plans/auto-review-analysis/")) return "generated artifact";
  if (path.startsWith("docs/plans/") || path.startsWith("docs/superpowers/plans/")) return "historical plan";
  if (path === "docs/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md") return "current execution plan";
  if (path.startsWith("docs/superpowers/specs/")) return "architecture reference";
  if (path.startsWith("docs/analysis/") || path.includes("analysis")) return "architecture reference";
  if (path.includes("handoff") || path.includes("development-")) return "historical record";
  return "current";
}

function getCurrentRole(path: string, area: string, fileType: string): string {
  if (fileType === "doc" || path.startsWith("docs/")) return `documentation: ${getDocClassification(path)}`;
  if (fileType === "generated code") return "generated Prisma client export";
  if (fileType === "schema") return "database schema";
  if (fileType === "migration") return "database migration or SQL maintenance input";
  if (fileType === "analysis data") return "checked-in analysis dataset";
  if (fileType === "prototype") return area.includes("design-demos") ? "static design-demo prototype" : "HTML prototype reference";
  if (fileType === "test") return path.includes("source") ? "source-contract test" : "regression test";
  if (area.startsWith("src/app/api")) return "route adapter";
  if (area.startsWith("src/app")) return "page or app route container";
  if (area.startsWith("src/components")) return "UI component or primitive";
  if (area.startsWith("src/features/training")) return "training frontend module";
  if (area.startsWith("src/server/repositories")) return "persistence repository";
  if (area.startsWith("src/server/services")) return "business service";
  if (area === "src/server/http") return "HTTP request helper";
  if (area.startsWith("src/server/worker")) return "worker or scheduler module";
  if (area.startsWith("src/lib/actions")) return "server action boundary";
  if (area.startsWith("src/lib")) return "shared library helper";
  if (area.startsWith("scripts")) return "maintenance script";
  if (area === "config") return "runtime configuration example or map";
  if (area === "public") return "static public asset";
  if (area === "root") return "root configuration or top-level reference";
  return "supporting source file";
}

function getTargetRole(path: string, area: string, fileType: string): string {
  if (fileType === "generated code") return "regenerate from Prisma only; no manual edits";
  if (path === INVENTORY_PATH) return "generated inventory for every tracked file";
  if (path === "docs/index.md") return "current read-first documentation map";
  if (fileType === "doc" || path.startsWith("docs/")) return `classified as ${getDocClassification(path)} with owner and update trigger`;
  if (fileType === "prototype") return "map to production/design-demo route or archive in later batch";
  if (area.startsWith("src/app/api")) return "thin route adapter over services and shared response helpers";
  if (area.startsWith("src/server/repositories")) return "query and persistence only";
  if (area.startsWith("src/server/services")) return "focused business workflow owner";
  if (area === "src/server/http") return "shared HTTP boundary helper";
  if (area.startsWith("src/features/training")) return "training-owned frontend module";
  if (area.startsWith("src/components")) return "focused accessible reusable UI";
  if (area.startsWith("tests")) return "stable verification entrypoint";
  if (area.startsWith("scripts")) return "documented repeatable script";
  return "keep under documented owner area";
}

function getAction(path: string, area: string, fileType: string): InventoryRow["action"] {
  if (fileType === "generated code") return ACTIONS.regenerate;
  if (path === INVENTORY_PATH) return ACTIONS.regenerate;
  if (fileType === "analysis data" || fileType === "prototype") return ACTIONS.archive;
  if (fileType === "doc" || path.startsWith("docs/") || path.endsWith(".md")) return ACTIONS.documentOnly;
  if (area.startsWith("src/app/api") || area.startsWith("src/server/repositories") || area.startsWith("src/server/services")) return ACTIONS.split;
  if (area.startsWith("src/features/training") || area.startsWith("src/app") || area.startsWith("src/components")) return ACTIONS.split;
  if (area.startsWith("scripts")) return ACTIONS.documentOnly;
  return ACTIONS.keep;
}

function makeRow(path: string): InventoryRow {
  const area = getArea(path);
  const fileType = getFileType(path, area);
  return {
    path,
    area,
    ownerModule: getOwnerModule(path, area),
    fileType,
    currentRole: getCurrentRole(path, area, fileType),
    targetRole: getTargetRole(path, area, fileType),
    action: getAction(path, area, fileType),
  };
}

function cell(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
}

const rows = allInventoryPaths().map(makeRow);
const output = [
  "# Repository Inventory",
  "",
  "Generated by `scripts/docs/generate-repo-inventory.ts`. Re-run the script whenever tracked files are added, removed, or moved.",
  "",
  "| path | area | owner module | file type | current role | target role | action |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| \`${row.path}\` | ${cell(row.area)} | ${cell(row.ownerModule)} | ${cell(row.fileType)} | ${cell(row.currentRole)} | ${cell(row.targetRole)} | ${row.action} |`,
  ),
  "",
].join("\n");

mkdirSync(dirname(INVENTORY_PATH), { recursive: true });
writeFileSync(INVENTORY_PATH, output);
