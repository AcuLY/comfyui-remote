import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { runConfiguredAdapters } from "./adapters";
import { assertPolicySchemaProfiles, loadMetadataValidator, loadPolicy } from "./config";
import { scanForbiddenConsumers } from "./consumers";
import { sortDiagnostics } from "./diagnostics";
import { listTrackedPaths, resolveComparison } from "./git";
import { parseMarkdownDocument } from "./markdown";
import type {
  CheckOptions,
  CheckResult,
  CommandAdapter,
  Diagnostic,
  GovernancePolicy,
  ParsedMarkdownDocument,
  ScopeRule,
} from "./model";
import {
  isExternalTarget,
  literalGlobPrefix,
  matchesAny,
  matchesRule,
  normalizeRepoPath,
  resolveRepoRelative,
} from "./path";
import { resolveEffectiveMode } from "./scope";

function absolutePath(root: string, path: string): string {
  return join(root, ...normalizeRepoPath(path).split("/"));
}

function scopeMatches(path: string, policy: GovernancePolicy): ScopeRule[] {
  return policy.scope.filter((scope) => matchesRule(path, scope.include, scope.exclude));
}

function metadataOwner(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "documentation-governance";
  const document = (metadata as Record<string, unknown>).document;
  if (!document || typeof document !== "object" || Array.isArray(document)) return "documentation-governance";
  const owner = (document as Record<string, unknown>).owner;
  return typeof owner === "string" && owner ? owner : "documentation-governance";
}

function metadataDocument(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const document = (metadata as Record<string, unknown>).document;
  if (!document || typeof document !== "object" || Array.isArray(document)) return null;
  return document as Record<string, unknown>;
}

function commandMatches(value: unknown, command: string[]): boolean {
  if (typeof value !== "string") return false;
  const expected = command.join(" ");
  return value === expected || value === `npx ${expected}`;
}

export function addGeneratedOwnershipDiagnostics(input: {
  path: string;
  metadata: unknown;
  adapter: CommandAdapter | undefined;
  tracked: Set<string>;
  diagnostics: Diagnostic[];
}): void {
  const document = metadataDocument(input.metadata);
  const owner = metadataOwner(input.metadata);
  if (!input.adapter) {
    input.diagnostics.push({
      ruleId: "generator/ownership",
      severity: "error",
      path: input.path,
      location: { line: 1, column: 1 },
      evidence: "The existing-generator profile has no controlled generator adapter owning this output.",
      remediation: "Register one non-writing controlled generator adapter whose output is this document.",
      owner,
    });
    return;
  }
  if (!document) return;
  const generator = input.adapter.command[1];
  const checks: Array<[boolean, string]> = [
    [document.owner === input.adapter.owner, `Metadata owner must equal adapter owner ${input.adapter.owner}.`],
    [document.generator === generator, `Metadata generator must equal controlled entrypoint ${generator}.`],
    [commandMatches(document.regenerate, input.adapter.command.slice(0, 2)), "Metadata regenerate must invoke the controlled generator without --check."],
    [commandMatches(document.check, input.adapter.command), "Metadata check must invoke the exact controlled non-writing adapter command."],
    [Array.isArray(document.verifiedBy) && document.verifiedBy.includes(document.check), "Metadata verifiedBy must include its exact non-writing check command."],
    [Array.isArray(document.sources) && document.sources.includes(generator), "Metadata sources must include its generator entrypoint."],
    [input.tracked.has(generator), `Controlled generator entrypoint is not tracked: ${generator}.`],
  ];
  for (const [valid, evidence] of checks) {
    if (valid) continue;
    input.diagnostics.push({
      ruleId: "generator/ownership",
      severity: "error",
      path: input.path,
      location: { line: 1, column: 1 },
      evidence,
      remediation: "Align generated-document provenance with docs/_meta/policy.yaml and the owning generator.",
      owner,
    });
  }
  for (const pattern of Array.isArray(document.inputs) ? document.inputs.filter((item): item is string => typeof item === "string") : []) {
    if ([...input.tracked].some((path) => matchesAny(path, [pattern]))) continue;
    input.diagnostics.push({
      ruleId: "generator/input-missing",
      severity: "error",
      path: input.path,
      location: { line: 1, column: 1 },
      evidence: `Generated-document input pattern matches no tracked path: ${pattern}`,
      remediation: "Repair the provenance input or restore the intended tracked source.",
      owner,
    });
  }
}

function shouldBeRegistered(path: string, policy: GovernancePolicy): boolean {
  if (policy.governedRoots.some((root) => path === root || path.startsWith(`${root}/`))) return true;
  if (!path.endsWith(".md")) return false;
  if (!path.includes("/")) return true;
  if ((path.startsWith("src/") || path.startsWith("tests/")) && !path.startsWith("tests/fixtures/")) return true;
  return false;
}

function resolveTrackedTarget(target: string, tracked: Set<string>): string | null {
  const directoryReadme = target ? `${target.replace(/\/$/, "")}/README.md` : "README.md";
  const candidates = [target, target ? `${target}.md` : "", directoryReadme].filter(Boolean);
  return candidates.find((candidate) => tracked.has(candidate)) ?? null;
}

function parseDocument(
  root: string,
  path: string,
  cache: Map<string, ParsedMarkdownDocument>,
): ParsedMarkdownDocument {
  const cached = cache.get(path);
  if (cached) return cached;
  const parsed = parseMarkdownDocument(path, readFileSync(absolutePath(root, path), "utf8"));
  cache.set(path, parsed);
  return parsed;
}

export type FastImpactClosure = {
  diagnosticPaths: Set<string>;
  relationshipIds: Set<string>;
  adapterIds: Set<string>;
};

function owningLanding(path: string, policy: GovernancePolicy): string | null {
  return policy.navigation.owners
    .filter((owner) => path !== owner.landing && matchesRule(path, owner.include, owner.exclude))
    .sort((left, right) => right.landing.length - left.landing.length || (left.id < right.id ? -1 : 1))[0]
    ?.landing ?? null;
}

export function computeFastImpactClosure(input: {
  policy: GovernancePolicy;
  trackedPaths: string[];
  current: Set<string>;
  graph: Map<string, Set<string>>;
  changedPaths: string[];
}): FastImpactClosure {
  const diagnosticPaths = new Set(input.changedPaths);
  const relationshipIds = new Set<string>();
  const adapterIds = new Set<string>();
  const seedDocuments = new Set(input.changedPaths.filter((path) => input.current.has(path)));
  const adapters = new Map(
    [...input.policy.adapters.generators, ...input.policy.adapters.contracts]
      .map((adapter) => [adapter.id, adapter] as const),
  );

  for (const relationship of input.policy.relationships) {
    const impacted = input.changedPaths.some((path) =>
      matchesAny(path, relationship.sources) || matchesAny(path, relationship.documents),
    );
    if (!impacted) continue;
    relationshipIds.add(relationship.id);
    for (const path of input.trackedPaths.filter((path) => matchesAny(path, relationship.documents))) {
      diagnosticPaths.add(path);
      if (input.current.has(path)) seedDocuments.add(path);
    }
    if (relationship.verifier) {
      adapterIds.add(relationship.verifier);
      const output = adapters.get(relationship.verifier)?.output;
      if (output) {
        diagnosticPaths.add(output);
        if (input.current.has(output)) seedDocuments.add(output);
      }
    }
  }

  const reverseGraph = new Map<string, Set<string>>();
  for (const [source, targets] of input.graph) {
    for (const target of targets) {
      const sources = reverseGraph.get(target) ?? new Set<string>();
      sources.add(source);
      reverseGraph.set(target, sources);
    }
  }
  const navigationNeighbors = new Set(seedDocuments);
  for (const path of seedDocuments) {
    for (const neighbor of input.graph.get(path) ?? []) navigationNeighbors.add(neighbor);
    for (const neighbor of reverseGraph.get(path) ?? []) navigationNeighbors.add(neighbor);
  }
  for (const path of navigationNeighbors) {
    diagnosticPaths.add(path);
    const landing = owningLanding(path, input.policy);
    if (landing) diagnosticPaths.add(landing);
  }

  return { diagnosticPaths, relationshipIds, adapterIds };
}

function resolveScopeAssignments(trackedPaths: string[], policy: GovernancePolicy): Map<string, ScopeRule> {
  const assigned = new Map<string, ScopeRule>();
  for (const path of trackedPaths) {
    const matches = scopeMatches(path, policy);
    if (matches.length === 1) assigned.set(path, matches[0]);
  }
  return assigned;
}

function currentDocuments(assigned: Map<string, ScopeRule>): Set<string> {
  return new Set(
    [...assigned]
      .filter(([path, scope]) => path.endsWith(".md") && scope.kind === "current")
      .map(([path]) => path),
  );
}

function addScopeDiagnostics(input: {
  trackedPaths: string[];
  policy: GovernancePolicy;
  diagnostics: Diagnostic[];
  diagnosticPaths: Set<string> | null;
}): void {
  for (const path of input.trackedPaths) {
    if (input.diagnosticPaths && !input.diagnosticPaths.has(path)) continue;
    const matches = scopeMatches(path, input.policy);
    if (matches.length > 1) {
      input.diagnostics.push({
        ruleId: "scope/ambiguous",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: `Path matches multiple scope rules: ${matches.map(({ id }) => id).join(", ")}`,
        remediation: "Make finite scope rules mutually exclusive.",
        owner: "documentation-governance",
      });
      continue;
    }
    if (matches.length === 0) {
      if (shouldBeRegistered(path, input.policy)) {
        input.diagnostics.push({
          ruleId: "scope/unregistered",
          severity: "error",
          path,
          location: { line: 1, column: 1 },
          evidence: "Tracked Markdown is inside a governed surface but matches no finite scope rule.",
          remediation: "Register, migrate, or delete the document; do not add an unrestricted catch-all.",
          owner: "documentation-governance",
        });
      }
    }
  }
}

function addForbiddenPathDiagnostics(
  trackedPaths: string[],
  policy: GovernancePolicy,
  diagnostics: Diagnostic[],
  diagnosticPaths: Set<string> | null,
): void {
  for (const forbidden of policy.forbiddenLivePaths) {
    for (const path of trackedPaths.filter((candidate) => matchesAny(candidate, [forbidden.path]))) {
      if (diagnosticPaths && !diagnosticPaths.has(path)) continue;
      diagnostics.push({
        ruleId: "topology/forbidden-path",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: `Tracked path matches forbidden surface ${forbidden.path}.`,
        remediation: `Move current knowledge to ${forbidden.replacement} and remove the legacy path.`,
        owner: forbidden.owner,
      });
    }
  }
}

function addRootEntrypointDiagnostics(input: {
  tracked: Set<string>;
  assigned: Map<string, ScopeRule>;
  policy: GovernancePolicy;
  diagnostics: Diagnostic[];
  diagnosticPaths: Set<string> | null;
}): void {
  for (const path of input.policy.rootEntrypoints) {
    if (input.diagnosticPaths && !input.diagnosticPaths.has(path)) continue;
    if (!input.tracked.has(path)) {
      input.diagnostics.push({
        ruleId: "topology/root-entrypoint-missing",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: "Policy declares this root entrypoint, but it is not tracked.",
        remediation: "Restore the root entrypoint or remove it through an approved policy change.",
        owner: "documentation-governance",
      });
    } else if (!input.assigned.has(path)) {
      input.diagnostics.push({
        ruleId: "topology/root-entrypoint-ungoverned",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: "Tracked root entrypoint does not resolve to exactly one governed scope.",
        remediation: "Assign the root entrypoint to one finite scope rule.",
        owner: "documentation-governance",
      });
    }
  }
}

function addMetadataDiagnostics(input: {
  root: string;
  tracked: Set<string>;
  assigned: Map<string, ScopeRule>;
  policy: GovernancePolicy;
  diagnostics: Diagnostic[];
  diagnosticPaths: Set<string> | null;
  cache: Map<string, ParsedMarkdownDocument>;
  validate(profile: string, metadata: unknown): string[];
}): Set<string> {
  const current = new Set<string>();
  for (const [path, scope] of input.assigned) {
    if (!path.endsWith(".md")) continue;
    if (scope.kind === "current") current.add(path);
    if (input.diagnosticPaths && !input.diagnosticPaths.has(path)) continue;
    let parsed: ParsedMarkdownDocument;
    try {
      parsed = parseDocument(input.root, path, input.cache);
    } catch (error) {
      input.diagnostics.push({
        ruleId: "metadata/frontmatter-parse",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: error instanceof Error ? error.message : String(error),
        remediation: "Repair the YAML frontmatter delimiters and syntax.",
        owner: "documentation-governance",
      });
      continue;
    }
    if (scope.frontmatter !== "documentation") continue;
    if (parsed.metadata === null || parsed.metadata === undefined) {
      input.diagnostics.push({
        ruleId: "metadata/missing",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: "Governed current document has no YAML frontmatter.",
        remediation: "Add metadata from the applicable docs/_meta template.",
        owner: "documentation-governance",
      });
      continue;
    }
    const profiles = input.policy.profiles.filter((profile) => matchesRule(path, profile.include, profile.exclude));
    if (profiles.length !== 1) {
      input.diagnostics.push({
        ruleId: profiles.length === 0 ? "metadata/profile-missing" : "metadata/profile-ambiguous",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: profiles.length === 0
          ? "No schema profile matches this governed document."
          : `Multiple schema profiles match: ${profiles.map(({ id }) => id).join(", ")}`,
        remediation: "Assign exactly one path-specific schema profile in policy.yaml.",
        owner: metadataOwner(parsed.metadata),
      });
      continue;
    }
    const schemaProfile = profiles[0].schemaProfile;
    for (const error of input.validate(schemaProfile, parsed.metadata)) {
      input.diagnostics.push({
        ruleId: "metadata/schema",
        severity: "error",
        path,
        location: parsed.metadataLocation,
        evidence: `${profiles[0].schemaProfile}: ${error}`,
        remediation: "Update the document frontmatter to satisfy its selected schema profile.",
        owner: metadataOwner(parsed.metadata),
      });
    }
    if (schemaProfile === "existing-generator") {
      addGeneratedOwnershipDiagnostics({
        path,
        metadata: parsed.metadata,
        adapter: input.policy.adapters.generators.find(({ output }) => output === path),
        tracked: input.tracked,
        diagnostics: input.diagnostics,
      });
    }
  }
  return current;
}

function addLinkAndGraphDiagnostics(input: {
  root: string;
  tracked: Set<string>;
  assigned: Map<string, ScopeRule>;
  current: Set<string>;
  policy: GovernancePolicy;
  diagnostics: Diagnostic[];
  diagnosticPaths: Set<string> | null;
  cache: Map<string, ParsedMarkdownDocument>;
}): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const [path, scope] of input.assigned) {
    if (!scope.links || !path.endsWith(".md")) continue;
    let parsed: ParsedMarkdownDocument;
    try {
      parsed = parseDocument(input.root, path, input.cache);
    } catch {
      continue;
    }
    const edges = graph.get(path) ?? new Set<string>();
    graph.set(path, edges);
    const emitDiagnostics = input.diagnosticPaths === null || input.diagnosticPaths.has(path);
    for (const link of parsed.links) {
      if (isExternalTarget(link.url)) continue;
      let resolved: { path: string; anchor: string | null };
      try {
        resolved = resolveRepoRelative(path, link.url);
      } catch (error) {
        if (emitDiagnostics) input.diagnostics.push({
          ruleId: "links/invalid-target",
          severity: "error",
          path,
          location: link.location,
          evidence: error instanceof Error ? error.message : String(error),
          remediation: "Use a valid contained repository-relative Markdown target.",
          owner: metadataOwner(parsed.metadata),
        });
        continue;
      }
      const target = resolveTrackedTarget(resolved.path, input.tracked);
      if (!target) {
        if (emitDiagnostics) input.diagnostics.push({
          ruleId: "links/target-missing",
          severity: "error",
          path,
          location: link.location,
          evidence: `Relative target does not resolve to a tracked path: ${link.url}`,
          remediation: "Repair the link or add the intended tracked target.",
          owner: metadataOwner(parsed.metadata),
        });
        continue;
      }
      if (input.current.has(target)) edges.add(target);
      if (resolved.anchor !== null && target.endsWith(".md")) {
        let targetDocument: ParsedMarkdownDocument;
        try {
          targetDocument = parseDocument(input.root, target, input.cache);
        } catch {
          continue;
        }
        if (emitDiagnostics && !targetDocument.anchors.has(resolved.anchor)) {
          input.diagnostics.push({
            ruleId: "links/anchor-missing",
            severity: "error",
            path,
            location: link.location,
            evidence: `Anchor #${resolved.anchor} does not exist in ${target}.`,
            remediation: "Link to a GitHub-compatible heading slug present in the target document.",
            owner: metadataOwner(parsed.metadata),
          });
        }
      }
      for (const forbidden of input.policy.forbiddenLivePaths) {
        if (emitDiagnostics && scope.kind === "current" && matchesAny(target, [forbidden.path])) {
          input.diagnostics.push({
            ruleId: "links/forbidden-live-path",
            severity: "error",
            path,
            location: link.location,
            evidence: `Live link targets forbidden path ${target}.`,
            remediation: `Route the link to ${forbidden.replacement}.`,
            owner: forbidden.owner,
          });
        }
      }
    }
    for (const forbidden of emitDiagnostics && scope.kind === "current" ? input.policy.forbiddenLivePaths : []) {
      const prefix = literalGlobPrefix(forbidden.path);
      if (prefix && parsed.liveText.includes(prefix)) {
        input.diagnostics.push({
          ruleId: "content/forbidden-live-path",
          severity: "error",
          path,
          location: { line: 1, column: 1 },
          evidence: `Live prose references forbidden path prefix ${prefix}.`,
          remediation: `Replace the live reference with ${forbidden.replacement}; examples belong in fenced or inline code.`,
          owner: forbidden.owner,
        });
      }
    }
  }
  return graph;
}

function addNavigationDiagnostics(input: {
  tracked: Set<string>;
  current: Set<string>;
  policy: GovernancePolicy;
  graph: Map<string, Set<string>>;
  diagnostics: Diagnostic[];
  diagnosticPaths: Set<string> | null;
}): void {
  for (const landing of input.policy.requiredLandingPages) {
    if (input.diagnosticPaths && !input.diagnosticPaths.has(landing)) continue;
    if (!input.tracked.has(landing)) {
      input.diagnostics.push({
        ruleId: "navigation/landing-missing",
        severity: "error",
        path: landing,
        location: { line: 1, column: 1 },
        evidence: "Policy requires this landing page, but it is not tracked.",
        remediation: "Create the required README.md landing page or correct policy.yaml.",
        owner: "documentation-governance",
      });
    }
  }
  const roots = input.policy.navigation.roots.filter((root) => input.tracked.has(root));
  for (const root of input.policy.navigation.roots.filter((path) => !input.tracked.has(path))) {
    if (input.diagnosticPaths && !input.diagnosticPaths.has(root)) continue;
    input.diagnostics.push({
      ruleId: "navigation/root-missing",
      severity: "error",
      path: root,
      location: { line: 1, column: 1 },
      evidence: "Navigation root is not tracked.",
      remediation: "Create the approved root entrypoint or correct policy.yaml.",
      owner: "documentation-governance",
    });
  }
  const reachable = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const path = queue.shift()!;
    if (reachable.has(path)) continue;
    reachable.add(path);
    for (const target of input.graph.get(path) ?? []) {
      if (!reachable.has(target)) queue.push(target);
    }
  }
  for (const path of input.current) {
    if (input.diagnosticPaths && !input.diagnosticPaths.has(path)) continue;
    if (!reachable.has(path)) {
      input.diagnostics.push({
        ruleId: "navigation/unreachable",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: "Current document is not reachable from an approved navigation root.",
        remediation: "Add an intentional router edge from the owning landing page.",
        owner: "documentation-governance",
      });
    }

    const owners = input.policy.navigation.owners
      .filter((owner) => path !== owner.landing && matchesRule(path, owner.include, owner.exclude))
      .sort((left, right) => right.landing.length - left.landing.length || (left.id < right.id ? -1 : 1));
    if (owners.length === 0) continue;
    const owner = owners[0];
    if (!owner.reverseLinkRequired) continue;
    if (!(input.graph.get(path) ?? new Set()).has(owner.landing)) {
      input.diagnostics.push({
        ruleId: "navigation/reverse-link",
        severity: "error",
        path,
        location: { line: 1, column: 1 },
        evidence: `Document does not link back to owning landing page ${owner.landing}.`,
        remediation: "Add a direct Markdown link to the owning landing page.",
        owner: owner.id,
      });
    }
  }
}

function addRelationshipDiagnostics(input: {
  policy: GovernancePolicy;
  tracked: Set<string>;
  changedPaths: string[];
  hasBase: boolean;
  effectiveMode: "full" | "fast";
  diagnostics: Diagnostic[];
  relationshipIds: Set<string> | null;
}): void {
  for (const relationship of input.policy.relationships) {
    if (input.relationshipIds && !input.relationshipIds.has(relationship.id)) continue;
    const resolvedDocuments = relationship.documents.flatMap((document) =>
      [...input.tracked].filter((path) => matchesAny(path, [document])),
    );
    for (const document of relationship.documents) {
      if (![...input.tracked].some((path) => matchesAny(path, [document]))) {
        input.diagnostics.push({
          ruleId: "relationships/document-missing",
          severity: "error",
          path: document,
          location: { line: 1, column: 1 },
          evidence: `Relationship ${relationship.id} targets an untracked document.`,
          remediation: "Repair the relationship target or add the governed document.",
          owner: relationship.owner,
        });
      }
    }
    const matched = input.hasBase
      ? input.changedPaths.some((path) => matchesAny(path, relationship.sources))
      : input.effectiveMode === "full";
    if (relationship.kind === "review" && matched) {
      input.diagnostics.push({
        ruleId: "relationships/review",
        severity: "warning",
        path: resolvedDocuments.sort()[0] ?? relationship.documents[0] ?? "docs/README.md",
        location: { line: 1, column: 1 },
        evidence: input.hasBase
          ? `Changed source matches semantic review relationship ${relationship.id}: ${relationship.reason}`
          : `No comparison base; conservatively emitting semantic review relationship ${relationship.id}: ${relationship.reason}`,
        remediation: "Disposition this owned warning with evidence; ordinary docs:check does not invoke $docs-audit.",
        owner: relationship.owner,
      });
    }
  }
}

export async function runDocsCheck(options: CheckOptions): Promise<CheckResult> {
  const policy = loadPolicy(options.root);
  const metadataValidator = loadMetadataValidator(options.root);
  assertPolicySchemaProfiles(policy, metadataValidator);
  const trackedPaths = listTrackedPaths(options.root);
  const tracked = new Set(trackedPaths);
  const comparison = resolveComparison(options.root, options.base);
  const effective = resolveEffectiveMode({
    requestedMode: options.mode,
    baseAvailable: comparison.mergeBase !== null,
    changes: comparison.changes,
  });
  const diagnostics: Diagnostic[] = [];
  const cache = new Map<string, ParsedMarkdownDocument>();
  const assigned = resolveScopeAssignments(trackedPaths, policy);
  const changedPaths = [
    ...new Set(
      comparison.changes.flatMap((change) => [change.oldPath, change.path].filter(Boolean) as string[]),
    ),
  ].sort();
  let closure: FastImpactClosure | null = null;
  if (effective.mode === "fast") {
    const preliminaryCurrent = currentDocuments(assigned);
    const preliminaryGraph = addLinkAndGraphDiagnostics({
      root: options.root,
      tracked,
      assigned,
      current: preliminaryCurrent,
      policy,
      diagnostics: [],
      diagnosticPaths: new Set(),
      cache,
    });
    closure = computeFastImpactClosure({
      policy,
      trackedPaths,
      current: preliminaryCurrent,
      graph: preliminaryGraph,
      changedPaths,
    });
  }
  const diagnosticPaths = closure?.diagnosticPaths ?? null;

  addScopeDiagnostics({ trackedPaths, policy, diagnostics, diagnosticPaths });
  addRootEntrypointDiagnostics({ tracked, assigned, policy, diagnostics, diagnosticPaths });
  addForbiddenPathDiagnostics(trackedPaths, policy, diagnostics, diagnosticPaths);
  diagnostics.push(...scanForbiddenConsumers({
    root: options.root,
    trackedPaths,
    policy,
    diagnosticPaths,
  }));
  const current = addMetadataDiagnostics({
    root: options.root,
    tracked,
    assigned,
    policy,
    diagnostics,
    diagnosticPaths,
    cache,
    validate: metadataValidator.validate,
  });
  const graph = addLinkAndGraphDiagnostics({
    root: options.root,
    tracked,
    assigned,
    current,
    policy,
    diagnostics,
    diagnosticPaths,
    cache,
  });
  addNavigationDiagnostics({ tracked, current, policy, graph, diagnostics, diagnosticPaths });
  addRelationshipDiagnostics({
    policy,
    tracked,
    changedPaths,
    hasBase: comparison.mergeBase !== null,
    effectiveMode: effective.mode,
    diagnostics,
    relationshipIds: closure?.relationshipIds ?? null,
  });
  if (options.runAdapters) {
    diagnostics.push(...runConfiguredAdapters(options.root, policy, closure?.adapterIds ?? null));
  }

  const sorted = sortDiagnostics(diagnostics);
  const errors = sorted.filter(({ severity }) => severity === "error").length;
  const warnings = sorted.length - errors;
  return {
    schemaVersion: 1,
    requestedMode: options.mode,
    effectiveMode: effective.mode,
    base: comparison.mergeBase,
    escalationReasons: effective.reasons,
    diagnostics: sorted,
    summary: { errors, warnings },
    exitCode: errors > 0 ? 1 : 0,
  };
}
