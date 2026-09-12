import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import yaml from "js-yaml";

import type {
  CommandAdapter,
  ContractAdapter,
  ContractAdapterKind,
  ForbiddenLivePath,
  GovernancePolicy,
  LanguageAllowedAsciiKind,
  LanguagePolicy,
  NavigationOwner,
  ProfileRule,
  ScopeRule,
  SourceRelationship,
} from "./model";
import { matchesAny, normalizeRepoPath } from "./path";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a mapping.`);
  }
  return value as UnknownRecord;
}

function assertAllowedKeys(value: UnknownRecord, label: string, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key)).sort();
  if (unknown.length > 0) throw new Error(`${label} contains unknown key(s): ${unknown.join(", ")}.`);
}

function assertRequiredKeys(value: UnknownRecord, label: string, required: readonly string[]): void {
  const missing = required.filter((key) => value[key] === undefined);
  if (missing.length > 0) throw new Error(`${label} is missing required key(s): ${missing.join(", ")}.`);
}

function normalizedPolicyPath(value: string, label: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`${label} must not contain a line break.`);
  const normalized = normalizeRepoPath(value);
  if (!normalized) throw new Error(`${label} must not resolve to the repository root.`);
  if (normalized !== value) {
    throw new Error(`${label} must use normalized Git path spelling: ${value}`);
  }
  return normalized;
}

function strings(value: unknown, label: string, fallback: string[] = []): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value.map((item, index) => normalizedPolicyPath(item as string, `${label}[${index}]`));
}

function requiredStrings(value: unknown, label: string): string[] {
  const result = strings(value, label);
  if (result.length === 0) throw new Error(`${label} must contain at least one item.`);
  return result;
}

function rawStrings(value: unknown, label: string, fallback: string[] = []): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value as string[];
}

function bool(value: unknown, fallback: boolean, label: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

const SUPPORTED_ALLOWED_ASCII_KINDS = [
  "repository-path",
  "command",
  "inline-code",
  "fenced-code",
  "protocol-field",
  "openspec-structure-keyword",
] as const satisfies readonly LanguageAllowedAsciiKind[];

const SUPPORTED_METADATA_EXCLUDED_FIELDS = [
  "schemaVersion",
  "name",
  "document.type",
  "document.status",
  "document.owner",
  "document.authority.subject",
  "document.authority.kind",
  "document.sources",
  "document.verifiedBy",
  "document.recovery",
  "document.verificationState",
  "document.lastVerified",
  "document.generator",
  "document.inputs",
  "document.regenerate",
  "document.check",
  "document.activation.stage",
  "document.activation.owner",
] as const;

function normalizeLanguage(value: unknown): LanguagePolicy {
  const language = record(value, "policy.language");
  assertAllowedKeys(language, "policy.language", [
    "requiredLanguage",
    "firstPartyMarkdown",
    "allowedAscii",
    "metadataExcludedFields",
    "dataPayloadExceptions",
  ]);
  assertRequiredKeys(language, "policy.language", [
    "requiredLanguage",
    "firstPartyMarkdown",
    "allowedAscii",
    "metadataExcludedFields",
    "dataPayloadExceptions",
  ]);
  if (language.requiredLanguage !== "zh-CN") {
    throw new Error("policy.language.requiredLanguage must equal zh-CN.");
  }

  const firstParty = record(language.firstPartyMarkdown, "policy.language.firstPartyMarkdown");
  assertAllowedKeys(firstParty, "policy.language.firstPartyMarkdown", ["include", "exclude"]);
  assertRequiredKeys(firstParty, "policy.language.firstPartyMarkdown", ["include", "exclude"]);
  const include = requiredStrings(firstParty.include, "policy.language.firstPartyMarkdown.include");
  const exclude = strings(firstParty.exclude, "policy.language.firstPartyMarkdown.exclude", []);
  if (include.some((pattern) => !pattern.toLowerCase().includes(".md"))) {
    throw new Error("policy.language.firstPartyMarkdown.include must contain only Markdown patterns.");
  }

  const allowedAscii = rawStrings(language.allowedAscii, "policy.language.allowedAscii") as LanguageAllowedAsciiKind[];
  const supported = new Set<string>(SUPPORTED_ALLOWED_ASCII_KINDS);
  const unknown = allowedAscii.filter((kind) => !supported.has(kind));
  if (unknown.length > 0) {
    throw new Error(`policy.language.allowedAscii contains unsupported kind(s): ${[...new Set(unknown)].sort().join(", ")}.`);
  }
  if (new Set(allowedAscii).size !== allowedAscii.length) {
    throw new Error("policy.language.allowedAscii must not contain duplicates.");
  }
  const missing = SUPPORTED_ALLOWED_ASCII_KINDS.filter((kind) => !allowedAscii.includes(kind));
  if (missing.length > 0) {
    throw new Error(`policy.language.allowedAscii is missing required kind(s): ${missing.join(", ")}.`);
  }

  const metadataExcludedFields = rawStrings(
    language.metadataExcludedFields,
    "policy.language.metadataExcludedFields",
  );
  const supportedMetadataFields = new Set<string>(SUPPORTED_METADATA_EXCLUDED_FIELDS);
  const unknownMetadataFields = metadataExcludedFields.filter((field) => !supportedMetadataFields.has(field));
  if (unknownMetadataFields.length > 0) {
    throw new Error(`policy.language.metadataExcludedFields contains unsupported field(s): ${[...new Set(unknownMetadataFields)].sort().join(", ")}.`);
  }
  if (new Set(metadataExcludedFields).size !== metadataExcludedFields.length) {
    throw new Error("policy.language.metadataExcludedFields must not contain duplicates.");
  }
  const missingMetadataFields = SUPPORTED_METADATA_EXCLUDED_FIELDS.filter(
    (field) => !metadataExcludedFields.includes(field),
  );
  if (missingMetadataFields.length > 0) {
    throw new Error(`policy.language.metadataExcludedFields is missing required field(s): ${missingMetadataFields.join(", ")}.`);
  }

  if (!Array.isArray(language.dataPayloadExceptions)) {
    throw new Error("policy.language.dataPayloadExceptions must be an array.");
  }
  const seenPayloadExceptions = new Set<string>();
  const dataPayloadExceptions = language.dataPayloadExceptions.map((item, index) => {
    const label = `policy.language.dataPayloadExceptions[${index}]`;
    const entry = record(item, label);
    assertAllowedKeys(entry, label, ["path", "kind", "headingDepth"]);
    assertRequiredKeys(entry, label, ["path", "kind", "headingDepth"]);
    const pathValue = String(entry.path ?? "");
    const path = normalizedPolicyPath(pathValue, `${label}.path`);
    if (!path.toLowerCase().endsWith(".md") || ["*", "?", "{", "}", "[", "]"].some((token) => path.includes(token))) {
      throw new Error(`${label}.path must name one exact Markdown file.`);
    }
    if (entry.kind !== "paragraph-after-heading") {
      throw new Error(`${label}.kind must equal paragraph-after-heading.`);
    }
    if (!Number.isInteger(entry.headingDepth) || Number(entry.headingDepth) < 1 || Number(entry.headingDepth) > 6) {
      throw new Error(`${label}.headingDepth must be an integer from 1 through 6.`);
    }
    const key = `${path}\0${entry.kind}\0${entry.headingDepth}`;
    if (seenPayloadExceptions.has(key)) {
      throw new Error("policy.language.dataPayloadExceptions must not contain duplicates.");
    }
    seenPayloadExceptions.add(key);
    return {
      path,
      kind: "paragraph-after-heading" as const,
      headingDepth: Number(entry.headingDepth),
    };
  });

  return {
    requiredLanguage: "zh-CN",
    firstPartyMarkdown: { include, exclude },
    allowedAscii,
    metadataExcludedFields,
    dataPayloadExceptions,
  };
}

function normalizeScope(value: unknown): ScopeRule[] {
  if (!Array.isArray(value)) throw new Error("policy.scope must be an array.");
  return value.map((item, index) => {
    const entry = record(item, `policy.scope[${index}]`);
    assertAllowedKeys(entry, `policy.scope[${index}]`, [
      "id", "kind", "include", "exclude", "frontmatter", "links", "navigation",
    ]);
    assertRequiredKeys(entry, `policy.scope[${index}]`, ["id", "kind", "include", "frontmatter", "links", "navigation"]);
    const id = String(entry.id ?? "").trim();
    const kind = String(entry.kind ?? "").trim();
    if (!id || !kind) throw new Error(`policy.scope[${index}] requires id and kind.`);
    const rawFrontmatter = entry.frontmatter ?? "none";
    if (!new Set(["documentation", "skill", "none"]).has(String(rawFrontmatter))) {
      throw new Error(`policy.scope[${index}].frontmatter is invalid.`);
    }
    return {
      id,
      kind,
      include: requiredStrings(entry.include, `policy.scope[${index}].include`),
      exclude: strings(entry.exclude, `policy.scope[${index}].exclude`, []),
      frontmatter: rawFrontmatter as ScopeRule["frontmatter"],
      links: bool(entry.links, kind === "current" || kind === "openspec" || kind === "skill", `policy.scope[${index}].links`),
      navigation: bool(entry.navigation, kind === "current", `policy.scope[${index}].navigation`),
    };
  });
}

function normalizeProfiles(value: unknown): ProfileRule[] {
  if (!Array.isArray(value)) throw new Error("policy.profiles must be an array.");
  return value.map((item, index) => {
    const entry = record(item, `policy.profiles[${index}]`);
    assertAllowedKeys(entry, `policy.profiles[${index}]`, ["id", "include", "exclude", "schemaProfile"]);
    assertRequiredKeys(entry, `policy.profiles[${index}]`, ["id", "include", "schemaProfile"]);
    const id = String(entry.id ?? "").trim();
    const schemaProfile = String(entry.schemaProfile ?? "").trim();
    if (!id || !schemaProfile) throw new Error(`policy.profiles[${index}] requires id and schemaProfile.`);
    return {
      id,
      include: requiredStrings(entry.include, `policy.profiles[${index}].include`),
      exclude: strings(entry.exclude, `policy.profiles[${index}].exclude`, []),
      schemaProfile,
    };
  });
}

function normalizeOwners(value: unknown): NavigationOwner[] {
  if (!Array.isArray(value)) throw new Error("policy.navigation.owners must be an array.");
  return value.map((item, index) => {
    const entry = record(item, `policy.navigation.owners[${index}]`);
    assertAllowedKeys(entry, `policy.navigation.owners[${index}]`, [
      "id", "landing", "include", "exclude", "reverseLinkRequired",
    ]);
    assertRequiredKeys(entry, `policy.navigation.owners[${index}]`, ["landing", "include", "reverseLinkRequired"]);
    const landingValue = String(entry.landing ?? "");
    const landing = landingValue ? normalizedPolicyPath(landingValue, `policy.navigation.owners[${index}].landing`) : "";
    if (!landing) throw new Error(`policy.navigation.owners[${index}] requires landing.`);
    return {
      id: String(entry.id ?? landing),
      landing,
      include: requiredStrings(entry.include, `policy.navigation.owners[${index}].include`),
      exclude: strings(entry.exclude, `policy.navigation.owners[${index}].exclude`, []),
      reverseLinkRequired: bool(entry.reverseLinkRequired, true, `policy.navigation.owners[${index}].reverseLinkRequired`),
    };
  });
}

function normalizeForbidden(value: unknown): ForbiddenLivePath[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("policy.forbiddenLivePaths must be an array.");
  return value.map((item, index) => {
    const entry = record(item, `policy.forbiddenLivePaths[${index}]`);
    assertAllowedKeys(entry, `policy.forbiddenLivePaths[${index}]`, ["path", "owner", "replacement"]);
    assertRequiredKeys(entry, `policy.forbiddenLivePaths[${index}]`, ["path", "owner", "replacement"]);
    const pathValue = String(entry.path ?? "");
    const path = pathValue ? normalizedPolicyPath(pathValue, `policy.forbiddenLivePaths[${index}].path`) : "";
    const owner = String(entry.owner ?? "documentation-governance").trim();
    const replacementValue = String(entry.replacement ?? "");
    const replacement = replacementValue
      ? normalizedPolicyPath(replacementValue, `policy.forbiddenLivePaths[${index}].replacement`)
      : "";
    if (!path || !replacement) throw new Error(`policy.forbiddenLivePaths[${index}] requires path and replacement.`);
    return { path, owner, replacement };
  });
}

function normalizeRelationships(value: unknown): SourceRelationship[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("policy.relationships must be an array.");
  return value.map((item, index) => {
    const entry = record(item, `policy.relationships[${index}]`);
    assertAllowedKeys(entry, `policy.relationships[${index}]`, [
      "id", "kind", "sources", "documents", "owner", "reason", "verifier",
    ]);
    assertRequiredKeys(entry, `policy.relationships[${index}]`, ["id", "kind", "sources", "documents", "owner"]);
    const kind = String(entry.kind ?? "");
    if (kind !== "contract" && kind !== "review") {
      throw new Error(`policy.relationships[${index}].kind must be contract or review.`);
    }
    const relationship: SourceRelationship = {
      id: String(entry.id ?? "").trim(),
      kind,
      sources: requiredStrings(entry.sources, `policy.relationships[${index}].sources`),
      documents: requiredStrings(entry.documents, `policy.relationships[${index}].documents`),
      owner: String(entry.owner ?? "").trim(),
      reason: typeof entry.reason === "string" ? entry.reason : undefined,
      verifier: typeof entry.verifier === "string" ? entry.verifier : undefined,
    };
    if (!relationship.id || !relationship.owner || relationship.documents.length === 0) {
      throw new Error(`policy.relationships[${index}] requires id, owner, sources, and documents.`);
    }
    if (kind === "contract" && !relationship.verifier) {
      throw new Error(`Contract relationship ${relationship.id} requires verifier.`);
    }
    if (kind === "contract" && relationship.reason !== undefined) {
      throw new Error(`Contract relationship ${relationship.id} must not declare a review reason.`);
    }
    if (kind === "review" && !relationship.reason) {
      throw new Error(`Review relationship ${relationship.id} requires reason.`);
    }
    if (kind === "review" && relationship.verifier !== undefined) {
      throw new Error(`Review relationship ${relationship.id} must not declare a verifier.`);
    }
    return relationship;
  });
}

function normalizeCommandAdapter(id: string, value: unknown, label: string): CommandAdapter {
  const entry = record(value, label);
  assertAllowedKeys(entry, label, ["id", "command", "owner", "output", "remediation"]);
  assertRequiredKeys(entry, label, ["id", "command", "owner", "output"]);
  let command = rawStrings(entry.command, `${label}.command`);
  if (command.length !== 3 || command[0] !== "tsx" || command[2] !== "--check") {
    throw new Error(`${label}.command must be exactly [tsx, scripts/docs/<generator>, --check].`);
  }
  const entrypoint = normalizedPolicyPath(command[1], `${label}.command[1]`);
  if (!entrypoint.startsWith("scripts/docs/") || !/\.(?:[cm]?[jt]s)$/.test(entrypoint)) {
    throw new Error(`${label}.command[1] must be a repository-owned script under scripts/docs/.`);
  }
  command = ["tsx", entrypoint, "--check"];
  const outputValue = entry.output;
  if (typeof outputValue !== "string" || outputValue.trim() === "") {
    throw new Error(`${label} requires an output document path.`);
  }
  const owner = String(entry.owner ?? "documentation-governance").trim();
  if (!owner) throw new Error(`${label}.owner must be non-empty.`);
  return {
    id,
    command,
    owner,
    output: normalizedPolicyPath(outputValue, `${label}.output`),
    remediation: typeof entry.remediation === "string" ? entry.remediation : undefined,
  };
}

function normalizeGenerators(value: unknown): CommandAdapter[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("policy.adapters.generators must be an array.");
  return value.map((item, index) => {
    const entry = record(item, `policy.adapters.generators[${index}]`);
    const id = String(entry.id ?? "").trim();
    if (!id) throw new Error(`policy.adapters.generators[${index}] requires id.`);
    return normalizeCommandAdapter(id, entry, `policy.adapters.generators[${index}]`);
  });
}

const CONTRACT_ADAPTER_KINDS = new Set<ContractAdapterKind>([
  "route-api-mcp-documentation",
  "runtime-configuration-documentation",
]);

function normalizeContracts(value: unknown): ContractAdapter[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("policy.adapters.contracts must be an array.");
  return value.map((item, index) => {
    const label = `policy.adapters.contracts[${index}]`;
    const entry = record(item, label);
    assertAllowedKeys(entry, label, ["id", "kind", "owner", "output", "remediation"]);
    assertRequiredKeys(entry, label, ["id", "kind", "owner", "output"]);
    const id = String(entry.id ?? "").trim();
    const kind = String(entry.kind ?? "") as ContractAdapterKind;
    const owner = String(entry.owner ?? "").trim();
    const outputValue = String(entry.output ?? "");
    if (!id || !owner || !outputValue) {
      throw new Error(`${label} requires id, kind, owner, and output.`);
    }
    if (!CONTRACT_ADAPTER_KINDS.has(kind)) {
      throw new Error(`${label}.kind is not a controlled contract adapter: ${kind}`);
    }
    return {
      id,
      kind,
      owner,
      output: normalizedPolicyPath(outputValue, `${label}.output`),
      remediation: typeof entry.remediation === "string" ? entry.remediation : undefined,
    };
  });
}

function assertUnique(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`${label} contains duplicate id ${item.id}.`);
    seen.add(item.id);
  }
}

export function loadPolicy(root: string, policyPath = "docs/_meta/policy.yaml"): GovernancePolicy {
  const absolute = join(root, ...normalizeRepoPath(policyPath).split("/"));
  const raw = record(yaml.load(readFileSync(absolute, "utf8")), "policy");
  assertAllowedKeys(raw, "policy", [
    "schemaVersion",
    "governedRoots",
    "rootEntrypoints",
    "language",
    "scope",
    "profiles",
    "requiredLandingPages",
    "navigation",
    "forbiddenLivePaths",
    "relationships",
    "adapters",
  ]);
  assertRequiredKeys(raw, "policy", [
    "schemaVersion",
    "governedRoots",
    "rootEntrypoints",
    "language",
    "scope",
    "profiles",
    "requiredLandingPages",
    "navigation",
    "forbiddenLivePaths",
    "relationships",
    "adapters",
  ]);
  if (raw.schemaVersion !== 1) throw new Error("policy.schemaVersion must equal 1.");
  const navigation = record(raw.navigation ?? {}, "policy.navigation");
  assertAllowedKeys(navigation, "policy.navigation", ["roots", "owners"]);
  assertRequiredKeys(navigation, "policy.navigation", ["roots", "owners"]);
  const adapters = record(raw.adapters ?? {}, "policy.adapters");
  assertAllowedKeys(adapters, "policy.adapters", ["openspec", "skills", "generators", "contracts"]);
  assertRequiredKeys(adapters, "policy.adapters", ["openspec", "skills", "generators", "contracts"]);
  const openspecValue = adapters.openspec ?? {};
  const openspec = record(openspecValue, "policy.adapters.openspec");
  assertAllowedKeys(openspec, "policy.adapters.openspec", ["enabled"]);
  assertRequiredKeys(openspec, "policy.adapters.openspec", ["enabled"]);
  const skillsValue = adapters.skills ?? {};
  const skills = record(skillsValue, "policy.adapters.skills");
  assertAllowedKeys(skills, "policy.adapters.skills", ["enabled", "paths"]);
  assertRequiredKeys(skills, "policy.adapters.skills", ["enabled", "paths"]);
  const policy: GovernancePolicy = {
    schemaVersion: 1,
    governedRoots: requiredStrings(raw.governedRoots, "policy.governedRoots"),
    rootEntrypoints: requiredStrings(raw.rootEntrypoints, "policy.rootEntrypoints"),
    language: normalizeLanguage(raw.language),
    scope: normalizeScope(raw.scope),
    profiles: normalizeProfiles(raw.profiles),
    requiredLandingPages: requiredStrings(raw.requiredLandingPages, "policy.requiredLandingPages"),
    navigation: {
      roots: requiredStrings(navigation.roots, "policy.navigation.roots"),
      owners: normalizeOwners(navigation.owners ?? []),
    },
    forbiddenLivePaths: normalizeForbidden(raw.forbiddenLivePaths),
    relationships: normalizeRelationships(raw.relationships),
    adapters: {
      openspec: {
        enabled: bool(openspec.enabled, false, "policy.adapters.openspec.enabled"),
      },
      skills: {
        enabled: bool(skills.enabled, false, "policy.adapters.skills.enabled"),
        paths: strings(skills.paths, "policy.adapters.skills.paths", []),
      },
      generators: normalizeGenerators(adapters.generators),
      contracts: normalizeContracts(adapters.contracts),
    },
  };
  if (policy.scope.length === 0) throw new Error("policy.scope must contain at least one rule.");
  if (policy.profiles.length === 0) throw new Error("policy.profiles must contain at least one rule.");
  if (policy.navigation.owners.length === 0) throw new Error("policy.navigation.owners must contain at least one owner.");
  if (policy.forbiddenLivePaths.length === 0) throw new Error("policy.forbiddenLivePaths must contain at least one rule.");
  if (policy.relationships.length === 0) throw new Error("policy.relationships must contain at least one rule.");
  assertUnique(policy.scope, "policy.scope");
  assertUnique(policy.profiles, "policy.profiles");
  assertUnique(policy.navigation.owners, "policy.navigation.owners");
  assertUnique(policy.relationships, "policy.relationships");
  assertUnique(policy.adapters.generators, "policy.adapters.generators");
  assertUnique(policy.adapters.contracts, "policy.adapters.contracts");
  assertUnique(
    [...policy.adapters.generators, ...policy.adapters.contracts],
    "policy.adapters generator and contract ids",
  );
  if (policy.adapters.skills.enabled && policy.adapters.skills.paths.length === 0) {
    throw new Error("policy.adapters.skills.paths must contain at least one path when Skill validation is enabled.");
  }
  if (!policy.adapters.openspec.enabled) {
    throw new Error("policy.adapters.openspec.enabled must be true for the repository documentation gate.");
  }
  if (!policy.adapters.skills.enabled) {
    throw new Error("policy.adapters.skills.enabled must be true for the repository documentation gate.");
  }
  const allAdapters = [...policy.adapters.generators, ...policy.adapters.contracts];
  const adaptersById = new Map(allAdapters.map((adapter) => [adapter.id, adapter]));
  const outputOwners = new Map<string, string>();
  for (const adapter of allAdapters) {
    const existing = outputOwners.get(adapter.output);
    if (existing) throw new Error(`Adapters ${existing} and ${adapter.id} both own output ${adapter.output}.`);
    outputOwners.set(adapter.output, adapter.id);
  }
  for (const relationship of policy.relationships) {
    if (relationship.verifier && !adaptersById.has(relationship.verifier)) {
      throw new Error(`Relationship ${relationship.id} references unknown verifier ${relationship.verifier}.`);
    }
    if (relationship.verifier) {
      const adapter = adaptersById.get(relationship.verifier)!;
      if (!matchesAny(adapter.output, relationship.documents)) {
        throw new Error(
          `Relationship ${relationship.id} does not include verifier output ${adapter.output} in its documents.`,
        );
      }
    }
  }
  const referencedAdapters = new Set(
    policy.relationships.flatMap(({ verifier }) => verifier ? [verifier] : []),
  );
  for (const adapter of allAdapters) {
    if (!referencedAdapters.has(adapter.id)) {
      throw new Error(`Controlled adapter ${adapter.id} is not referenced by a contract relationship.`);
    }
  }
  return policy;
}

export function assertPolicySchemaProfiles(policy: GovernancePolicy, validator: MetadataValidator): void {
  for (const profile of policy.profiles) {
    if (!validator.profiles.has(profile.schemaProfile)) {
      throw new Error(`Policy profile ${profile.id} references unknown schema profile ${profile.schemaProfile}.`);
    }
  }
}

export type MetadataValidator = {
  profiles: Set<string>;
  validate(profile: string, metadata: unknown): string[];
};

export function loadMetadataValidator(root: string, schemaPath = "docs/_meta/documentation.schema.json"): MetadataValidator {
  const absolute = join(root, ...normalizeRepoPath(schemaPath).split("/"));
  const schema = JSON.parse(readFileSync(absolute, "utf8")) as UnknownRecord;
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  if (!ajv.validateSchema(schema)) {
    throw new Error(`documentation.schema.json is invalid: ${ajv.errorsText(ajv.errors)}`);
  }
  const definitions = record(schema.$defs, "documentation.schema.json $defs");
  const nested = definitions.profiles && typeof definitions.profiles === "object" && !Array.isArray(definitions.profiles)
    ? definitions.profiles as UnknownRecord
    : null;
  const declaredProfileRefs = Array.isArray(schema.anyOf)
    ? schema.anyOf
      .map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as UnknownRecord).$ref : null)
      .filter((value): value is string => typeof value === "string" && value.startsWith("#/$defs/"))
    : [];
  const candidates = nested
    ? Object.entries(nested).map(([name]) => [name, `#/$defs/profiles/${name}`] as const)
    : declaredProfileRefs.map((reference) => [reference.split("/").at(-1)!, reference] as const);
  const schemaId = typeof schema.$id === "string" ? schema.$id : "urn:comfyui-manager:documentation-schema";
  ajv.addSchema({ ...schema, $id: schemaId }, schemaId);
  const validators = new Map<string, ValidateFunction>();
  for (const [name, pointer] of candidates) {
    const validator = ajv.getSchema(`${schemaId}${pointer}`) ?? ajv.compile({ $ref: `${schemaId}${pointer}` });
    validators.set(name, validator);
  }
  return {
    profiles: new Set(validators.keys()),
    validate(profile, metadata) {
      const validator = validators.get(profile);
      if (!validator) throw new Error(`Unknown documentation schema profile: ${profile}`);
      if (validator(metadata)) return [];
      return [...(validator.errors ?? [])]
        .sort((left, right) => `${left.instancePath}:${left.keyword}`.localeCompare(`${right.instancePath}:${right.keyword}`))
        .map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`);
    },
  };
}
