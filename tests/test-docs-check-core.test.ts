import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadPolicy } from "../scripts/docs/check/config";
import { scanForbiddenConsumers } from "../scripts/docs/check/consumers";
import { sortDiagnostics } from "../scripts/docs/check/diagnostics";
import { addGeneratedOwnershipDiagnostics } from "../scripts/docs/check/engine";
import { parseMarkdownDocument } from "../scripts/docs/check/markdown";
import { normalizeRepoPath, resolveRepoRelative } from "../scripts/docs/check/path";
import { resolveEffectiveMode } from "../scripts/docs/check/scope";

test("documentation diagnostics have a stable locale-independent order", () => {
  const diagnostics = sortDiagnostics([
    {
      ruleId: "links/broken",
      severity: "error",
      path: "docs/z.md",
      location: { line: 4, column: 2 },
      evidence: "z",
      remediation: "fix z",
      owner: "docs",
    },
    {
      ruleId: "metadata/missing",
      severity: "error",
      path: "docs/a.md",
      location: { line: 2, column: 1 },
      evidence: "a2",
      remediation: "fix a2",
      owner: "docs",
    },
    {
      ruleId: "metadata/missing",
      severity: "warning",
      path: "docs/a.md",
      location: { line: 1, column: 1 },
      evidence: "a1",
      remediation: "fix a1",
      owner: "docs",
    },
  ]);

  assert.deepEqual(
    diagnostics.map(({ path, location, ruleId }) => `${path}:${location.line}:${ruleId}`),
    ["docs/a.md:1:metadata/missing", "docs/a.md:2:metadata/missing", "docs/z.md:4:links/broken"],
  );
});

test("repository path normalization is POSIX and rejects root escape", () => {
  assert.equal(normalizeRepoPath("docs\\architecture\\README.md"), "docs/architecture/README.md");
  assert.equal(normalizeRepoPath("./docs/../docs/README.md"), "docs/README.md");
  assert.throws(() => normalizeRepoPath("../outside.md"), /escapes repository root/i);
  assert.throws(() => normalizeRepoPath("C:\\outside.md"), /absolute/i);
});

test("Markdown targets reject root-absolute paths and preserve repository-root directory links", () => {
  assert.throws(() => resolveRepoRelative("docs/README.md", "/README.md"), /repository-relative/i);
  assert.deepEqual(resolveRepoRelative("docs/README.md", ".."), { path: "", anchor: null });
});

test("GFM parsing uses GitHub duplicate heading slugs and ignores code references", () => {
  const parsed = parseMarkdownDocument(
    "docs/guide.md",
    [
      "---",
      "schemaVersion: 1",
      "document:",
      "  type: architecture",
      "---",
      "# Same heading",
      "",
      "# Same heading",
      "",
      "[valid duplicate](#same-heading-1)",
      "",
      "`docs/archive/ignored.md`",
      "",
      "```text",
      "docs/archive/also-ignored.md",
      "```",
      "",
    ].join("\n"),
  );

  assert.deepEqual([...parsed.anchors], ["same-heading", "same-heading-1"]);
  assert.equal(parsed.links[0]?.url, "#same-heading-1");
  assert.equal(parsed.liveText.includes("docs/archive/ignored.md"), false);
  assert.equal(parsed.liveText.includes("docs/archive/also-ignored.md"), false);
  assert.equal(parsed.links[0]?.location.line, 10);
});

test("fast mode escalates for unsafe paths, missing bases, and deletes", () => {
  assert.deepEqual(
    resolveEffectiveMode({ requestedMode: "fast", baseAvailable: true, changes: [{ status: "M", path: "docs/guide.md" }] }),
    { mode: "fast", reasons: [] },
  );
  assert.equal(
    resolveEffectiveMode({ requestedMode: "fast", baseAvailable: false, changes: [] }).mode,
    "full",
  );
  assert.equal(
    resolveEffectiveMode({
      requestedMode: "fast",
      baseAvailable: true,
      changes: [{ status: "M", path: "docs/_meta/policy.yaml" }],
    }).mode,
    "full",
  );
  assert.equal(
    resolveEffectiveMode({ requestedMode: "fast", baseAvailable: true, changes: [{ status: "D", path: "docs/guide.md" }] }).mode,
    "full",
  );
  for (const path of [
    "docs/architecture/system/README.md",
    ".codebuddy/skills/example/SKILL.md",
    "package-lock.json",
    "tests/test-documentation-governance.test.ts",
  ]) {
    assert.equal(
      resolveEffectiveMode({ requestedMode: "fast", baseAvailable: true, changes: [{ status: "M", path }] }).mode,
      "full",
      `${path} must force full mode`,
    );
  }
});

test("policy rejects executable argv on typed contract adapters and uncontrolled generator commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "docs-policy-control-"));
  try {
    await mkdir(join(root, "docs", "_meta"), { recursive: true });
    const base = [
      "schemaVersion: 1",
      "governedRoots: [docs]",
      "rootEntrypoints: [README.md]",
      "scope:",
      "  - id: root",
      "    kind: current",
      "    include: [README.md]",
      "    frontmatter: documentation",
      "    links: true",
      "    navigation: true",
      "profiles:",
      "  - id: root",
      "    include: [README.md]",
      "    schemaProfile: router",
      "requiredLandingPages: [docs/README.md]",
      "navigation:",
      "  roots: [README.md]",
      "  owners:",
      "    - landing: docs/README.md",
      "      include: [docs/**/*.md]",
      "      reverseLinkRequired: true",
      "forbiddenLivePaths:",
      "  - path: docs/archive/**",
      "    owner: docs",
      "    replacement: docs/README.md",
      "relationships:",
      "  - id: contract",
      "    kind: contract",
      "    sources: [src/**]",
      "    documents: [docs/output.md]",
      "    owner: docs",
      "    verifier: contract",
      "adapters:",
      "  openspec: { enabled: true }",
      "  skills: { enabled: true, paths: [.codex/skills] }",
    ];

    await writeFile(join(root, "docs", "_meta", "policy.yaml"), [
      ...base,
      "  generators: []",
      "  contracts:",
      "    - id: contract",
      "      kind: route-api-mcp-documentation",
      "      owner: docs",
      "      output: docs/output.md",
      "      command: [powershell, -Command, write-output unsafe]",
      "",
    ].join("\n"));
    assert.throws(() => loadPolicy(root), /unknown key.*command/i);

    await writeFile(join(root, "docs", "_meta", "policy.yaml"), [
      ...base,
      "  generators:",
      "    - id: contract",
      "      command: [powershell, -Command, write-output unsafe]",
      "      owner: docs",
      "      output: docs/output.md",
      "  contracts: []",
      "",
    ].join("\n"));
    assert.throws(() => loadPolicy(root), /must be exactly \[tsx/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("policy parser converts controlled npm and generator adapter declarations", () => {
  const policy = loadPolicy(process.cwd(), "tests/fixtures/documentation-governance/checker/adapter-policy.yaml");
  assert.equal(policy.adapters.openspec.enabled, true);
  assert.equal(policy.adapters.skills.enabled, true);
  assert.deepEqual(policy.adapters.skills.paths, [".codex/skills", ".codebuddy/skills"]);
  assert.deepEqual(policy.adapters.generators[0], {
    id: "repo-inventory",
    command: ["tsx", "scripts/docs/generate-repo-inventory.ts", "--check"],
    owner: "documentation-governance",
    output: "docs/repo-inventory.md",
    remediation: undefined,
  });
});

test("generated-document provenance must agree with its controlled adapter", () => {
  const adapter = {
    id: "inventory",
    command: ["tsx", "scripts/docs/generate-inventory.ts", "--check"],
    owner: "documentation-governance",
    output: "docs/inventory.md",
  };
  const metadata = {
    schemaVersion: 1,
    document: {
      owner: "documentation-governance",
      sources: ["scripts/docs/generate-inventory.ts"],
      verifiedBy: ["npx tsx scripts/docs/generate-inventory.ts --check"],
      generator: "scripts/docs/generate-inventory.ts",
      inputs: ["src/**"],
      regenerate: "npx tsx scripts/docs/generate-inventory.ts",
      check: "npx tsx scripts/docs/generate-inventory.ts --check",
    },
  };
  const diagnostics: Parameters<typeof addGeneratedOwnershipDiagnostics>[0]["diagnostics"] = [];
  addGeneratedOwnershipDiagnostics({
    path: "docs/inventory.md",
    metadata,
    adapter,
    tracked: new Set(["scripts/docs/generate-inventory.ts", "src/example.ts"]),
    diagnostics,
  });
  assert.deepEqual(diagnostics, []);

  addGeneratedOwnershipDiagnostics({
    path: "docs/inventory.md",
    metadata: {
      ...metadata,
      document: { ...metadata.document, check: "npx tsx scripts/docs/other.ts --check" },
    },
    adapter,
    tracked: new Set(["scripts/docs/generate-inventory.ts", "src/example.ts"]),
    diagnostics,
  });
  assert.ok(diagnostics.some(({ ruleId }) => ruleId === "generator/ownership"));
});

test("forbidden consumer scan covers code and structured config while excluding evidence and negative fixtures", async () => {
  const root = await mkdtemp(join(tmpdir(), "docs-consumer-scan-"));
  try {
    const files: Record<string, string> = {
      "src/consumer.ts": 'readFileSync("docs/archive/live.md", "utf8");\n',
      "src/consumer.js": 'import legacy from "docs/archive/live.js";\n',
      "src/template.ts": 'readFileSync(`docs/archive/${name}.md`, "utf8");\n',
      "src/object-key.ts": 'const legacy = { "docs/archive/live.md": true };\n',
      "config/runtime.json": '{"template":"docs/archive/live.json"}\n',
      "config/runtime.yaml": "template: docs/archive/live.yaml\n",
      "config/key.json": '{"docs/archive/live.json":true}\n',
      "config/key.jsonc": '{/* docs/archive/comment.json */"docs/archive/live.json":true}\n',
      "config/key.yaml": '"docs/archive/live.yaml": true\n',
      "config/runtime.toml": 'template = "docs/archive/live.toml"\n',
      "config/comment.toml": '# template = "docs/archive/comment.toml"\n',
      ".env.example": "LEGACY_PATH=docs/archive/live.env\n",
      ".env.comment": "# LEGACY_PATH=docs/archive/comment.env\n",
      "Dockerfile": "COPY docs/archive/live.md /app/live.md\n",
      "Dockerfile.comment": "# COPY docs/archive/comment.md /app/comment.md\n",
      "package.json": '{"scripts":{"legacy":"node docs/archive/live.js"}}\n',
      "openspec/config.yaml": "source: docs/archive/live.md\n",
      "openspec/changes/migration/evidence/config.yaml": "source: docs/archive/evidence.md\n",
      "tests/fixtures/documentation-governance/negative.ts": 'readFileSync("docs/archive/fixture.md");\n',
      "tests/stale-consumer.test.ts": 'const RETAINED_CONTEXT_DOCS = ["docs/archive/live.md"];\n',
      "tests/assert-consumer.test.ts": 'assert.ok(existsSync("docs/archive/live.md"));\n',
      "tests/negative.test.ts": 'assert.doesNotMatch(source, /docs\\/archive/);\n',
      "src/negative.ts": '// readFileSync("docs/archive/comment.md");\n/docs\\/archive/.test("unrelated");\n',
      "scripts/consumer.py": 'legacy_path = "docs\\archive\\live.md"\n',
      "scripts/consumer.ps1": '$legacyPath = "docs\\archive\\live.md"\n',
      "scripts/consumer.sh": 'legacy_path="docs/archive/live.md"\n',
      "scripts/consumer.bat": 'set LEGACY_PATH="docs/archive/live.md"\n',
      "scripts/consumer.cmd": 'set LEGACY_PATH="docs/archive/live.md"\n',
      "scripts/negative.py": '# legacy_path = "docs/archive/comment.md"\n',
      "scripts/negative.ps1": '<# $legacyPath = "docs/archive/comment.md" #>\n',
    };
    for (const [path, source] of Object.entries(files)) {
      await mkdir(join(root, ...path.split("/").slice(0, -1)), { recursive: true });
      await writeFile(join(root, ...path.split("/")), source);
    }
    const policy = loadPolicy(
      process.cwd(),
      "tests/fixtures/documentation-governance/checker/valid-repository/docs/_meta/policy.yaml",
    );
    const diagnostics = scanForbiddenConsumers({
      root,
      trackedPaths: Object.keys(files),
      policy,
      diagnosticPaths: null,
    });
    assert.deepEqual(
      diagnostics.map(({ path }) => path).sort(),
      [
        ".env.example",
        "Dockerfile",
        "config/key.json",
        "config/key.jsonc",
        "config/key.yaml",
        "config/runtime.json",
        "config/runtime.toml",
        "config/runtime.yaml",
        "openspec/config.yaml",
        "package.json",
        "scripts/consumer.bat",
        "scripts/consumer.cmd",
        "scripts/consumer.ps1",
        "scripts/consumer.py",
        "scripts/consumer.sh",
        "src/consumer.js",
        "src/consumer.ts",
        "src/object-key.ts",
        "src/template.ts",
        "tests/assert-consumer.test.ts",
        "tests/stale-consumer.test.ts",
      ],
    );
    assert.ok(diagnostics.every(({ ruleId }) => ruleId === "content/forbidden-consumer"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
