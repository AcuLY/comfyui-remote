import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { fail } from "../src/lib/api-response";
import { proxy } from "../src/proxy";

function normalizeRepositoryPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function read(path: string): string {
  const normalized = normalizeRepositoryPath(path);
  assert.ok(existsSync(normalized), `${normalized} must exist`);
  return readFileSync(normalized, "utf8");
}

function listFiles(root: string, fileName: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path, fileName));
    } else if (entry.name === fileName) {
      files.push(normalizeRepositoryPath(path));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("root README is a stable router instead of a volatile source inventory", () => {
  const readme = read("README.md");

  for (const route of [
    "PRODUCT.md",
    "ARCHITECTURE.md",
    "DESIGN.md",
    "docs/README.md",
    "docs/api/README.md",
    "docs/testing/README.md",
    "docs/runbooks/README.md",
    "openspec/README.md",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(route)), `README must route to ${route}`);
  }

  assert.match(readme, /Node\.js \*\*20\.19/);
  assert.match(readme, /OpenSpec/);
  assert.doesNotMatch(readme, /current(?:ly)?\s+(?:registers?|contains?|has)\s+\d+/i);
  assert.doesNotMatch(readme, /\b\d+\s+(?:HTTP\s+)?(?:endpoints?|routes?|tools?|resources?)\b/i);
  assert.doesNotMatch(readme, /当前(?:注册|包含|具有|共有)\s*\d+\s*(?:个)?(?:端点|路由|工具|资源)/);
});

test("documentation router owns authority classification and task routing", () => {
  const docs = read("docs/README.md");

  for (const authorityClass of [
    "当前",
    "已批准目标",
    "生成的当前产物",
    "延期占位",
    "历史",
  ]) {
    assert.match(docs, new RegExp(`\\| ${escapeRegExp(authorityClass)} \\|`));
  }

  for (const route of [
    "architecture/README.md",
    "product/README.md",
    "design/README.md",
    "api/README.md",
    "testing/README.md",
    "runbooks/README.md",
    "_meta/README.md",
    "../openspec/README.md",
  ]) {
    assert.match(docs, new RegExp(escapeRegExp(route)), `docs router must route to ${route}`);
  }
});

test("future context files are honest deferred placeholders", () => {
  const placeholders = [
    ["docs/QUALITY_SCORE.md", "enforce-engineering-standards", /分数、阈值/],
    ["docs/RELIABILITY.md", "build-agent-observability", /指标、SLO/],
    ["docs/SECURITY.md", "future-approved-security-governance", /威胁模型、控制集/],
  ] as const;

  for (const [path, stage, boundary] of placeholders) {
    const source = read(path);
    assert.match(source, /type: placeholder/);
    assert.match(source, /status: deferred/);
    assert.match(source, /kind: placeholder/);
    assert.match(source, new RegExp(`stage: ${escapeRegExp(stage)}`));
    assert.match(source, /condition:/);
    assert.match(source, boundary);
    assert.match(source, /OpenSpec/);
    assert.match(source, /不(?:拥有|定义|授权)/);
    assert.match(source, /待办/);
    assert.doesNotMatch(source, /\b(?:score|threshold|SLO|risk rating)\s*[:=]\s*\d/i);
    assert.doesNotMatch(source, /(?:分数|阈值|SLO|风险等级)\s*[:=：]\s*\d/i);
  }
});

test("documented API families are a source-backed subset without volatile counts", () => {
  const apiDocs = read("docs/api/README.md");
  const documentedFamilies = [
    ["/api/agent/**", "src/app/api/agent"],
    ["/api/projects/**", "src/app/api/projects"],
    ["/api/training/**", "src/app/api/training"],
    ["/api/preset-library/**", "src/app/api/preset-library"],
    ["/api/queue/**", "src/app/api/queue"],
    ["/api/worker/**", "src/app/api/worker"],
    ["/api/mcp", "src/app/api/mcp"],
  ] as const;

  for (const [family, sourceRoot] of documentedFamilies) {
    assert.match(apiDocs, new RegExp(escapeRegExp(family)), `${family} must be documented`);
    assert.ok(listFiles(sourceRoot, "route.ts").length > 0, `${family} must exist in current source`);
  }

  assert.doesNotMatch(apiDocs, /\b\d+\s+(?:HTTP\s+)?(?:endpoints?|routes?|tools?|resources?)\b/i);
  assert.doesNotMatch(apiDocs, /\d+\s*(?:个)?(?:端点|路由|工具|资源)/);
});

test("public login and auth routes stay reachable while protected surfaces require auth", () => {
  const previousAuthToken = process.env.AUTH_TOKEN;
  process.env.AUTH_TOKEN = "documentation-governance-test-token";

  try {
    const loginResponse = proxy(new NextRequest("http://localhost/login"));
    assert.equal(loginResponse.status, 200);

    const publicAuthResponse = proxy(new NextRequest("http://localhost/api/auth/verify"));
    assert.equal(publicAuthResponse.status, 200);

    const protectedPageResponse = proxy(new NextRequest("http://localhost/projects/example"));
    assert.equal(protectedPageResponse.status, 307);
    const redirect = new URL(protectedPageResponse.headers.get("location") ?? "");
    assert.equal(redirect.pathname, "/login");
    assert.equal(redirect.searchParams.get("from"), "/projects/example");

    const protectedApiResponse = proxy(new NextRequest("http://localhost/api/projects"));
    assert.equal(protectedApiResponse.status, 401);

    const authorizedApiResponse = proxy(
      new NextRequest("http://localhost/api/projects", {
        headers: { authorization: "Bearer documentation-governance-test-token" },
      }),
    );
    assert.equal(authorizedApiResponse.status, 200);
  } finally {
    if (previousAuthToken === undefined) {
      delete process.env.AUTH_TOKEN;
    } else {
      process.env.AUTH_TOKEN = previousAuthToken;
    }
  }
});

test("API auth, envelope, MCP transport, and workflow ownership match source", async () => {
  const apiDocs = read("docs/api/README.md");
  const proxy = read("src/proxy.ts");
  const responses = read("src/lib/api-response.ts");
  const mcpRoute = read("src/app/api/mcp/route.ts");
  const workflowReader = read("src/server/services/comfyui-service.ts");

  for (const [sourceToken, documentedToken] of [
    ["authorization", "Bearer token"],
    ["x-api-token", "x-api-token"],
    ["x-auth-token", "x-auth-token"],
    ["auth_token", "auth_token"],
  ] as const) {
    assert.match(proxy, new RegExp(escapeRegExp(sourceToken), "i"));
    assert.match(apiDocs, new RegExp(escapeRegExp(documentedToken), "i"));
  }

  assert.match(responses, /\{ ok: true, data \}/);
  assert.match(responses, /\{ ok: false, error: \{ message, details \} \}/);
  assert.match(apiDocs, /\{ "ok": true, "data": \.\.\. \}/);
  assert.match(apiDocs, /只有[^。]*提供 `details`[^。]*才包含[^。]*`"details": \.\.\.`/);

  assert.deepEqual(await fail("without details").json(), {
    ok: false,
    error: { message: "without details" },
  });
  assert.deepEqual(await fail("with details", 422, { field: "name" }).json(), {
    ok: false,
    error: { message: "with details", details: { field: "name" } },
  });

  for (const method of ["GET", "POST", "DELETE"]) {
    assert.match(mcpRoute, new RegExp(`export async function ${method}\\(`));
    assert.match(apiDocs, new RegExp(`\\b${method}\\b`));
  }
  assert.match(mcpRoute, /WebStandardStreamableHTTPServerTransport/);
  assert.match(mcpRoute, /sessionIdGenerator: undefined/);
  assert.match(apiDocs, /Web Standard Streamable HTTP 传输实现/);
  assert.match(apiDocs, /无状态传输实例/);

  assert.match(
    workflowReader,
    /"config",\s*"workflows",\s*"standard-workflow\.api\.json"/,
  );
  assert.match(workflowReader, /fs\.readFile\(filePath, "utf-8"\)/);
  assert.match(apiDocs, /config\/workflows\/standard-workflow\.api\.json/);
  assert.match(apiDocs, /src\/server\/services\/comfyui-service\.ts/);
});

test("route template keeps the reusable pattern and not an adopter inventory", () => {
  const template = read("docs/api/route-handler-template.md");

  for (const helper of ["readJsonObject", "ok", "fail", "failFromError"]) {
    assert.match(template, new RegExp(`\\b${helper}\\b`));
  }
  assert.doesNotMatch(template, /## Current Adopters/i);
  assert.deepEqual(
    [...template.matchAll(/`(src\/app\/api\/[^`]+\/route\.ts)`/g)].map((match) => match[1]),
    ["src/app/api/logs/route.ts", "src/app/api/queue-data/route.ts"],
    "the template may name only its two controlled compatibility exceptions",
  );
});

test("testing docs preserve path portability and the current quality contract", () => {
  const testing = read("docs/testing/README.md");
  const quality = read("docs/testing/quality-analysis.md");

  assert.equal(normalizeRepositoryPath("tests\\fixtures\\example.json"), "tests/fixtures/example.json");
  assert.match(testing, /由源码支持的子集和不变量/);
  assert.match(testing, /仓库路径统一为 `\/`/);
  assert.match(testing, /本地运行数据库、日志、指标、生成缓存和密钥都不是 fixture/);

  for (const path of [
    "tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json",
    "reports/quality/auto-review-analysis/phase0-labeled-images.csv",
    "reports/quality/auto-review-analysis/valid-projects-trash-rate-summary.json",
  ]) {
    assert.ok(existsSync(path), `${path} must exist`);
    assert.match(quality, new RegExp(escapeRegExp(path)));
  }

  assert.match(quality, /干净检出[^。]*只能[^。]*已提交的 `summary` 产物/);
  assert.match(quality, /重生成依赖未提交的本地 SQLite 数据库/);
  assert.match(quality, /sourceDb[^。]*reportPaths[^。]*绝对来源追踪路径/);
  assert.match(quality, /历史 PRD[^；]*不是当前流水线承诺/);
});
