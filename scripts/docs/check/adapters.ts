import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { CommandAdapter, ContractAdapter, ContractAdapterKind, Diagnostic, GovernancePolicy } from "./model";

type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

const CONTRACT_TEST_FILES: Record<ContractAdapterKind, string> = {
  "route-api-mcp-documentation": "tests/test-documentation-governance.test.ts",
  "runtime-configuration-documentation": "tests/test-config-runtime-governance.test.ts",
};

type ContractEnvelope = {
  schemaVersion?: number;
  exitClass?: "pass" | "violation" | "tool";
  failures?: Array<{ test?: string; name?: string; code?: string | null; message?: string }>;
  evidence?: string;
};

function resolveInvocation(root: string, command: string[]): { executable: string; args: string[] } {
  const [executable, ...args] = command;
  if (executable === "node") return { executable: process.execPath, args };
  if (executable === "tsx") {
    return { executable: process.execPath, args: [join(root, "node_modules", "tsx", "dist", "cli.mjs"), ...args] };
  }
  if (executable === "openspec") {
    return {
      executable: process.execPath,
      args: [join(root, "node_modules", "@fission-ai", "openspec", "bin", "openspec.js"), ...args],
    };
  }
  throw new Error(`Uncontrolled documentation adapter executable: ${executable}`);
}

function run(root: string, command: string[]): CommandResult {
  const invocation = resolveInvocation(root, command);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    OPENSPEC_TELEMETRY: "0",
  };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    env,
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 2, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function conciseOutput(result: CommandResult): string {
  const output = `${result.stdout}\n${result.stderr}`.trim().replace(/\s+/g, " ");
  return output.length > 1000 ? `${output.slice(0, 997)}...` : output || `process exited ${result.status}`;
}

function runGenerator(root: string, adapter: CommandAdapter): Diagnostic[] {
  const result = run(root, adapter.command);
  if (result.status === 0) return [];
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 1 || !/\bis stale\b/i.test(output)) {
    throw new Error(`Generator adapter ${adapter.id} crashed: ${conciseOutput(result)}`);
  }
  return [{
    ruleId: `generator/${adapter.id}`,
    severity: "error",
    path: adapter.output,
    location: { line: 1, column: 1 },
    evidence: conciseOutput(result),
    remediation: adapter.remediation ?? `Run the write-mode command for ${adapter.id}, review the result, and rerun docs:check.`,
    owner: adapter.owner,
  }];
}

function runContract(root: string, adapter: ContractAdapter): Diagnostic[] {
  const testFile = CONTRACT_TEST_FILES[adapter.kind];
  if (!testFile) throw new Error(`Unknown controlled contract adapter kind: ${adapter.kind}`);
  const runner = join(root, "scripts", "docs", "check", "contract-runner.mjs");
  if (!existsSync(runner)) throw new Error(`Controlled contract runner is missing: ${runner}`);
  const checkerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const localLoader = join(root, "node_modules", "tsx", "dist", "loader.mjs");
  const loader = existsSync(localLoader)
    ? localLoader
    : join(checkerRoot, "node_modules", "tsx", "dist", "loader.mjs");
  if (!existsSync(loader)) throw new Error(`Pinned tsx loader is missing for contract adapter ${adapter.id}.`);
  const result = run(root, ["node", "--import", pathToFileURL(loader).href, runner, testFile]);
  let payload: ContractEnvelope;
  try {
    payload = JSON.parse(result.stdout) as ContractEnvelope;
  } catch {
    throw new Error(`Contract adapter ${adapter.id} returned no structured result: ${conciseOutput(result)}`);
  }
  if (payload.schemaVersion !== 1) {
    throw new Error(`Contract adapter ${adapter.id} returned an unsupported result schema.`);
  }
  if (payload.exitClass === "pass" && result.status === 0) return [];
  if (payload.exitClass !== "violation" || result.status !== 1 || !payload.failures?.length) {
    throw new Error(`Contract adapter ${adapter.id} failed as a tool: ${payload.evidence ?? conciseOutput(result)}`);
  }
  return [{
    ruleId: `contract/${adapter.id}`,
    severity: "error",
    path: adapter.output,
    location: { line: 1, column: 1 },
    evidence: payload.failures
      .map((failure) => `${failure.test ?? "unknown"}: ${failure.name ?? "AssertionError"}: ${failure.message ?? "assertion mismatch"}`)
      .join("; "),
    remediation: adapter.remediation ?? `Repair the ${adapter.kind} contract and rerun docs:check.`,
    owner: adapter.owner,
  }];
}

function assertPinnedOpenSpec(root: string): void {
  const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const installedPackage = JSON.parse(
    readFileSync(join(root, "node_modules", "@fission-ai", "openspec", "package.json"), "utf8"),
  ) as { version?: string };
  const declared = rootPackage.devDependencies?.["@fission-ai/openspec"]
    ?? rootPackage.dependencies?.["@fission-ai/openspec"];
  const installed = installedPackage.version;
  if (!declared || !installed || declared !== installed || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(declared)) {
    throw new Error(
      `OpenSpec must be pinned exactly and match the installed package (declared=${declared ?? "missing"}, installed=${installed ?? "missing"}).`,
    );
  }
}

function runOpenSpec(root: string): Diagnostic[] {
  const binary = join(root, "node_modules", "@fission-ai", "openspec", "bin", "openspec.js");
  if (!existsSync(binary)) throw new Error(`Pinned OpenSpec binary is missing: ${binary}`);
  assertPinnedOpenSpec(root);
  const result = run(root, ["openspec", "validate", "--all", "--strict", "--no-interactive", "--json"]);
  let payload: { items?: Array<{ id?: string; type?: string; valid?: boolean; issues?: unknown[] }> };
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`OpenSpec validation did not return JSON: ${conciseOutput(result)}`);
  }
  const diagnostics: Diagnostic[] = [];
  for (const item of payload.items ?? []) {
    if (item.valid !== false) continue;
    diagnostics.push({
      ruleId: "openspec/strict-validation",
      severity: "error",
      path: item.type === "spec" ? `openspec/specs/${item.id ?? "unknown"}` : `openspec/changes/${item.id ?? "unknown"}`,
      location: { line: 1, column: 1 },
      evidence: JSON.stringify(item.issues ?? []),
      remediation: "Repair the OpenSpec artifact and rerun the pinned strict validator.",
      owner: "openspec",
    });
  }
  if (result.status !== 0 && diagnostics.length === 0) {
    throw new Error(`OpenSpec validation failed without structured issues: ${conciseOutput(result)}`);
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`OpenSpec validator crashed: ${conciseOutput(result)}`);
  }
  return diagnostics;
}

function runSkills(root: string, paths: string[]): Diagnostic[] {
  const validator = join(root, "scripts", "skills", "validate.mjs");
  if (!existsSync(validator)) throw new Error(`Repository Skill validator is missing: ${validator}`);
  const result = run(root, ["node", validator, "--json", ...paths]);
  let payload: { diagnostics?: Diagnostic[]; exitCode?: number };
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Skill validation did not return JSON: ${conciseOutput(result)}`);
  }
  if (result.status === 2 || payload.exitCode === 2) {
    throw new Error(`Skill validator failed: ${conciseOutput(result)}`);
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Skill validator crashed: ${conciseOutput(result)}`);
  }
  const diagnostics = payload.diagnostics ?? [];
  if (result.status === 1 && diagnostics.length === 0) {
    throw new Error(`Skill validator failed without structured diagnostics: ${conciseOutput(result)}`);
  }
  return diagnostics;
}

export function runConfiguredAdapters(
  root: string,
  policy: GovernancePolicy,
  selectedIds: Set<string> | null = null,
): Diagnostic[] {
  const selected = (id: string): boolean => selectedIds === null || selectedIds.has(id);
  return [
    ...(selectedIds === null && policy.adapters.openspec.enabled ? runOpenSpec(root) : []),
    ...(selectedIds === null && policy.adapters.skills.enabled ? runSkills(root, policy.adapters.skills.paths) : []),
    ...policy.adapters.generators.filter(({ id }) => selected(id)).flatMap((adapter) => runGenerator(root, adapter)),
    ...policy.adapters.contracts.filter(({ id }) => selected(id)).flatMap((adapter) => runContract(root, adapter)),
  ];
}
