import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("health route stays minimal and safe for probes", async () => {
  const source = readFileSync("src/app/api/health/route.ts", "utf8");

  assert.match(source, /from ["']@\/lib\/api-response["']/);
  assert.doesNotMatch(source, /process\.env|prisma|readFile|writeFile|fetch\(/);

  const route = await import("../src/app/api/health/route");
  const response = await route.GET();
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.service, "comfyui-manager");
  assert.equal(payload.data.status, "ok");
  assert.equal(typeof payload.data.timestamp, "string");
});

test("MCP route delegates transport handling to the server module only", () => {
  const source = readFileSync("src/app/api/mcp/route.ts", "utf8");

  assert.match(source, /from ["']@\/server\/mcp\/server["']/);
  assert.match(source, /getMcpServer\(\)/);
  assert.equal((source.match(/return handleMcpRequest\(request\);/g) ?? []).length, 3);
  assert.doesNotMatch(source, /AgentRun|AgentProject|prisma|workflow|listProjects|getProject/);
});
