import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const instrumentationSource = readFileSync("src/instrumentation.ts", "utf8");
const nodeInstrumentationSource = readFileSync("src/instrumentation.node.ts", "utf8");

test("instrumentation entrypoint keeps Node-only startup work behind the Next runtime guard", () => {
  assert.match(
    instrumentationSource,
    /Next instrumentation runtime split/,
    "instrumentation.ts should document the runtime split from the local Next instrumentation docs.",
  );
  assert.doesNotMatch(
    instrumentationSource,
    /^import\s/m,
    "instrumentation.ts should not top-level import modules that can be traced into the Edge bundle.",
  );
  assert.match(instrumentationSource, /export async function register\(\)/);
  assert.match(instrumentationSource, /process\.env\.NEXT_RUNTIME === "nodejs"/);
  assert.match(instrumentationSource, /require\("\.\/instrumentation\.node"\)/);
  assert.doesNotMatch(instrumentationSource, /@\/(?:server|lib\/db|lib\/env)/);
});

test("node instrumentation file documents that it owns server-only startup side effects", () => {
  assert.match(
    nodeInstrumentationSource,
    /Node-only startup boundary/,
    "instrumentation.node.ts should make its server-only ownership explicit.",
  );
  assert.match(nodeInstrumentationSource, /registerNodeInstrumentation/);
  assert.match(nodeInstrumentationSource, /createLogger/);
  assert.match(nodeInstrumentationSource, /process\.on\("SIGTERM"/);
  assert.match(nodeInstrumentationSource, /process\.on\("SIGINT"/);
});
