import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import type { AnySchema } from "ajv";
import { load } from "js-yaml";
import { minimatch } from "minimatch";

const SCHEMA_PATH = "docs/_meta/documentation.schema.json";
const POLICY_PATH = "docs/_meta/policy.yaml";
const FIXTURE_ROOT = "tests/fixtures/documentation-governance/metadata";
const PROFILE_NAMES = [
  "router",
  "architecture",
  "product",
  "design",
  "api",
  "testing",
  "runbook",
  "placeholder",
  "root-file",
  "existing-generator",
] as const;

type ProfileName = (typeof PROFILE_NAMES)[number];
type UnknownMap = Record<string, unknown>;

type FixtureCase = {
  file: string;
  profile: ProfileName;
  valid: boolean;
};

type PolicyScope = {
  id: string;
  include: string[];
  kind: string;
  frontmatter: string;
  links: boolean;
  navigation: boolean;
};

type PolicyProfile = {
  id: string;
  include: string[];
  schemaProfile: ProfileName;
};

type PolicyOwner = {
  landing: string;
  include: string[];
  reverseLinkRequired: boolean;
};

type PolicyRelationship = {
  id: string;
  kind: "contract" | "review";
  sources: string[];
  documents: string[];
  owner: string;
  verifier?: string;
  reason?: string;
};

type DocumentationPolicy = {
  schemaVersion: number;
  governedRoots: string[];
  rootEntrypoints: string[];
  scope: PolicyScope[];
  profiles: PolicyProfile[];
  requiredLandingPages: string[];
  navigation: {
    roots: string[];
    owners: PolicyOwner[];
  };
  forbiddenLivePaths: Array<{
    path: string;
    owner: string;
    replacement: string;
  }>;
  relationships: PolicyRelationship[];
  adapters: {
    openspec: { enabled: boolean };
    skills: { enabled: boolean; paths: string[] };
    generators: Array<{
      id: string;
      command: string[];
      owner: string;
      output: string;
      remediation: string;
    }>;
    contracts: Array<{
      id: string;
      kind: "route-api-mcp-documentation" | "runtime-configuration-documentation";
      owner: string;
      output: string;
      remediation: string;
      command?: unknown;
    }>;
  };
};

function readJson(path: string): UnknownMap {
  return JSON.parse(readFileSync(path, "utf8")) as UnknownMap;
}

function readYaml<T>(path: string): T {
  return load(readFileSync(path, "utf8")) as T;
}

function assertUnique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(path, pattern, { dot: true, nocase: false }));
}

function listFiles(root: string, base = root): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path, base));
    } else {
      files.push(relative(base, path));
    }
  }

  return files;
}

function parseTemplateFrontmatter(path: string): UnknownMap {
  const source = readFileSync(path, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  assert.ok(match, `${path} must start with YAML frontmatter`);
  return load(match[1]) as UnknownMap;
}

test("documentation schema publishes every approved profile under draft 2020-12", () => {
  const schema = readJson(SCHEMA_PATH);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(typeof schema.$id, "string");

  const definitions = schema.$defs as UnknownMap;
  assert.ok(definitions, "schema must expose $defs");
  for (const profile of PROFILE_NAMES) {
    assert.ok(definitions[profile], `schema must expose $defs.${profile}`);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema);
  for (const profile of PROFILE_NAMES) {
    assert.doesNotThrow(() =>
      ajv.compile({ $ref: `${String(schema.$id)}#/$defs/${profile}` }),
    );
  }
});

test("metadata fixtures prove profile-specific positive and negative contracts", () => {
  const schema = readJson(SCHEMA_PATH);
  const manifest = readYaml<{ cases: FixtureCase[] }>(join(FIXTURE_ROOT, "cases.yaml"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema);

  assert.ok(manifest.cases.length >= 8, "metadata fixtures must cover all specialized profiles");
  for (const fixture of manifest.cases) {
    const validate = ajv.compile({
      $ref: `${String(schema.$id)}#/$defs/${fixture.profile}`,
    });
    const metadata = readYaml<unknown>(join(FIXTURE_ROOT, fixture.file));
    const actual = validate(metadata);
    assert.equal(
      actual,
      fixture.valid,
      `${fixture.file} expected valid=${fixture.valid}: ${JSON.stringify(validate.errors)}`,
    );
  }
});

test("repository metadata paths accept normalized Git paths and reject escape forms", () => {
  const schema = readJson(SCHEMA_PATH);
  const definitions = schema.$defs as UnknownMap;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
    definitions._repositoryPath as AnySchema,
  );
  const cases = readYaml<{ valid: string[]; invalid: string[] }>(
    join(FIXTURE_ROOT, "path-cases.yaml"),
  );

  for (const path of cases.valid) {
    assert.equal(validate(path), true, `${path} should be a normalized repository path`);
  }
  for (const path of cases.invalid) {
    assert.equal(validate(path), false, `${path} must be rejected as unsafe or non-normalized`);
  }
});

test("policy defines finite non-overlapping scope and explicit profile selection", () => {
  const schema = readJson(SCHEMA_PATH);
  const definitions = schema.$defs as UnknownMap;
  const policy = readYaml<DocumentationPolicy>(POLICY_PATH);

  assert.equal(policy.schemaVersion, 1);
  assert.deepEqual(policy.governedRoots, ["docs"]);
  assert.deepEqual(policy.rootEntrypoints, [
    "README.md",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "PRODUCT.md",
    "DESIGN.md",
    "CLAUDE.md",
  ]);
  assertUnique(policy.scope.map(({ id }) => id), "scope ids");
  assertUnique(policy.profiles.map(({ id }) => id), "profile ids");

  for (const scope of policy.scope) {
    assert.ok(scope.include.length > 0, `${scope.id} must include at least one pattern`);
    assert.ok(
      ["documentation", "skill", "none"].includes(scope.frontmatter),
      `${scope.id} has an unknown frontmatter mode`,
    );
    assert.equal(typeof scope.links, "boolean");
    assert.equal(typeof scope.navigation, "boolean");
  }

  const currentDocs = policy.scope.find(({ id }) => id === "current-docs");
  assert.ok(currentDocs, "policy must define the current docs scope");
  assert.equal(
    currentDocs.include.some((pattern) => pattern === "docs/**" || pattern === "docs/**/*.md"),
    false,
    "current documentation must not use an unrestricted docs catch-all",
  );
  for (const ownerRoot of [
    "docs/architecture/**/*.md",
    "docs/product/**/*.md",
    "docs/design/**/*.md",
    "docs/runbooks/**/*.md",
    "docs/api/**/*.md",
    "docs/testing/**/*.md",
  ]) {
    assert.ok(currentDocs.include.includes(ownerRoot), `${ownerRoot} must be an allowed owner area`);
  }

  for (const profile of policy.profiles) {
    assert.ok(
      PROFILE_NAMES.includes(profile.schemaProfile),
      `${profile.id} selects unknown schema profile ${profile.schemaProfile}`,
    );
    assert.ok(definitions[profile.schemaProfile]);
  }

  const expectedProfiles: Record<string, ProfileName> = {
    "README.md": "root-file",
    "docs/README.md": "router",
    "docs/architecture/README.md": "router",
    "docs/architecture/core-beliefs.md": "architecture",
    "docs/product/training/README.md": "router",
    "docs/product/training/current-capabilities.md": "product",
    "docs/design/layout-and-density.md": "design",
    "docs/runbooks/deployment/queue-safety.md": "runbook",
    "docs/api/agent-contract.md": "api",
    "docs/testing/test-infrastructure.md": "testing",
    "docs/QUALITY_SCORE.md": "placeholder",
    "docs/repo-inventory.md": "existing-generator",
    "docs/prisma-schema-compatibility.md": "existing-generator",
  };

  for (const [path, expectedProfile] of Object.entries(expectedProfiles)) {
    const matched = policy.profiles.filter(({ include }) => matchesAny(path, include));
    assert.equal(
      matched.length,
      1,
      `${path} must select exactly one profile, got ${matched.map(({ id }) => id).join(", ")}`,
    );
    assert.equal(matched[0].schemaProfile, expectedProfile);

    const scopes = policy.scope.filter(({ include }) => matchesAny(path, include));
    assert.equal(scopes.length, 1, `${path} must resolve to exactly one governed scope`);
  }

  assert.ok(
    policy.scope.some(({ id, include }) =>
      id === "compatibility-skills" && include.includes(".codebuddy/skills/**"),
    ),
    "the existing .codebuddy compatibility surface must be classified explicitly",
  );
});

test("policy encodes required navigation owners and forbidden legacy surfaces", () => {
  const policy = readYaml<DocumentationPolicy>(POLICY_PATH);
  assert.deepEqual(policy.navigation.roots, [
    "README.md",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "PRODUCT.md",
    "DESIGN.md",
    "docs/README.md",
  ]);
  assertUnique(policy.navigation.owners.map(({ landing }) => landing), "owner landing pages");
  assertUnique(policy.requiredLandingPages, "required landing pages");

  for (const requiredLanding of [
    "docs/architecture/README.md",
    "docs/architecture/system/README.md",
    "docs/architecture/system/execution/README.md",
    "docs/architecture/domains/README.md",
    "docs/product/README.md",
    "docs/design/README.md",
    "docs/runbooks/README.md",
    "docs/runbooks/deployment/README.md",
    "docs/api/README.md",
    "docs/testing/README.md",
  ]) {
    const owner = policy.navigation.owners.find(({ landing }) => landing === requiredLanding);
    assert.ok(owner, `${requiredLanding} must be a required owner landing`);
    assert.equal(owner.reverseLinkRequired, true);
    assert.ok(
      policy.requiredLandingPages.includes(requiredLanding),
      `${requiredLanding} must be checked for tracked existence`,
    );
  }

  const forbidden = new Set(policy.forbiddenLivePaths.map(({ path }) => path));
  for (const path of [
    "agent-rules/**",
    "docs/index.md",
    "docs/documentation-map.md",
    "docs/exec-plans/**",
    "docs/history/**",
    "docs/archive/**",
    "docs/prototypes/**",
    "docs/plans/**",
    "docs/superpowers/**",
    "position_presets.md",
    "docs/workflow.api.json",
  ]) {
    assert.ok(forbidden.has(path), `${path} must be forbidden from the accepted live tree`);
  }
  for (const rule of policy.forbiddenLivePaths) {
    assert.ok(rule.owner.length > 0, `${rule.path} needs an owner`);
    assert.ok(rule.replacement.length > 0, `${rule.path} needs a replacement or recovery route`);
  }
});

test("source relationships are typed and contract verifiers resolve to controlled adapters", () => {
  const schema = readJson(SCHEMA_PATH);
  const definitions = schema.$defs as UnknownMap;
  const policy = readYaml<DocumentationPolicy>(POLICY_PATH);
  const validatePattern = new Ajv2020({ allErrors: true, strict: true }).compile(
    definitions._repositoryPattern as AnySchema,
  );
  const adapterIds = new Set(
    [...policy.adapters.generators, ...policy.adapters.contracts].map(({ id }) => id),
  );

  assert.deepEqual(
    policy.adapters.skills.paths,
    [".codex/skills", ".codebuddy/skills"],
    "docs:check must validate every registered project Skill surface",
  );

  assertUnique(policy.relationships.map(({ id }) => id), "relationship ids");
  assert.ok(policy.relationships.some(({ kind }) => kind === "contract"));
  assert.ok(policy.relationships.some(({ kind }) => kind === "review"));

  for (const relationship of policy.relationships) {
    assert.ok(relationship.sources.length > 0, `${relationship.id} needs source patterns`);
    assert.ok(relationship.documents.length > 0, `${relationship.id} needs document patterns`);
    for (const pattern of [...relationship.sources, ...relationship.documents]) {
      assert.equal(validatePattern(pattern), true, `${relationship.id} has unsafe pattern ${pattern}`);
    }

    if (relationship.kind === "contract") {
      assert.ok(relationship.verifier, `${relationship.id} must name a blocking verifier`);
      assert.ok(
        adapterIds.has(relationship.verifier),
        `${relationship.id} verifier must resolve to a controlled adapter`,
      );
      assert.equal(relationship.reason, undefined);
    } else {
      assert.ok(relationship.reason, `${relationship.id} review needs an owned reason`);
      assert.equal(relationship.verifier, undefined, `${relationship.id} review must not run a verifier`);
    }
  }

  assert.equal(policy.adapters.openspec.enabled, true);
  assert.equal(policy.adapters.skills.enabled, true);
  assert.deepEqual(policy.adapters.skills.paths, [".codex/skills", ".codebuddy/skills"]);
  for (const adapter of policy.adapters.generators) {
    assert.ok(adapter.command.length > 0, `${adapter.id} must use an argv command`);
    assert.ok(
      adapter.command.includes("--test") || adapter.command.includes("--check"),
      `${adapter.id} must use an explicit non-writing test or check mode`,
    );
    assert.ok(adapter.owner.length > 0);
    assert.ok(adapter.output.length > 0);
    assert.ok(adapter.remediation.length > 0);
  }
  assert.deepEqual(
    policy.adapters.contracts.map(({ kind }) => kind).sort(),
    ["route-api-mcp-documentation", "runtime-configuration-documentation"],
  );
  for (const adapter of policy.adapters.contracts) {
    assert.equal(adapter.command, undefined, `${adapter.id} must not accept policy-provided argv`);
    assert.ok(adapter.owner.length > 0);
    assert.ok(adapter.output.length > 0);
    assert.ok(adapter.remediation.length > 0);
  }
});

test("control plane contains only schema, policy, README, and approved templates", () => {
  const files = listFiles("docs/_meta")
    .map((path) => path.replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(files, [
    "README.md",
    "documentation.schema.json",
    "policy.yaml",
    "templates/directory-readme.md",
    "templates/document.md",
    "templates/runbook.md",
  ]);

  const templates = [
    ["docs/_meta/templates/document.md", "architecture"],
    ["docs/_meta/templates/directory-readme.md", "router"],
    ["docs/_meta/templates/runbook.md", "runbook"],
  ] as const;

  for (const [path, type] of templates) {
    const metadata = parseTemplateFrontmatter(path);
    assert.equal(metadata.schemaVersion, 1);
    const document = metadata.document as UnknownMap;
    assert.equal(document.type, type);
    for (const key of ["status", "owner", "authority", "readWhen", "sources", "verifiedBy"]) {
      assert.ok(key in document, `${path} must include document.${key}`);
    }
  }

  const runbook = parseTemplateFrontmatter("docs/_meta/templates/runbook.md").document as UnknownMap;
  for (const key of ["environment", "risk", "recovery", "lastVerified"]) {
    assert.ok(key in runbook, `runbook template must include ${key}`);
  }

  const readme = readFileSync("docs/_meta/README.md", "utf8");
  assert.match(readme, /Do not add a per-file owner registry/);
  assert.match(readme, /never invokes `\$docs-audit` automatically/);
});
