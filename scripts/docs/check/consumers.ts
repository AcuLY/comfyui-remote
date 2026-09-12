import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import yaml from "js-yaml";

import type { Diagnostic, ForbiddenLivePath, GovernancePolicy } from "./model";
import { literalGlobPrefix, normalizeRepoPath } from "./path";

const CODE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const STRUCTURED_EXTENSION = /\.(?:jsonc?|ya?ml)$/;
const SCRIPT_EXTENSION = /\.(?:py|ps1|sh|bat|cmd)$/;
const TOML_EXTENSION = /\.toml$/;

function textConfig(path: string): boolean {
  const name = path.split("/").at(-1) ?? path;
  return name.startsWith(".env") || name === "Dockerfile" || name.startsWith("Dockerfile.") || TOML_EXTENSION.test(name);
}

function consumerSurface(path: string): boolean {
  if (path === "package-lock.json") return false;
  if (path === "package.json" || path === "openspec/config.yaml" || path === "openspec/config.yml") return true;
  if (["src/", "scripts/", "config/", "tests/", ".github/", ".codex/", ".codebuddy/"].some((prefix) => path.startsWith(prefix))) {
    return true;
  }
  return textConfig(path)
    || (!path.includes("/") && (CODE_EXTENSION.test(path) || STRUCTURED_EXTENSION.test(path) || SCRIPT_EXTENSION.test(path)));
}

function excluded(path: string): boolean {
  return path === "docs/_meta/policy.yaml"
    || path.startsWith("scripts/docs/check/")
    || /^tests\/test-docs-check-.*\.test\.ts$/.test(path)
    || path.startsWith("tests/fixtures/documentation-governance/")
    || path.startsWith("openspec/changes/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function forbiddenMatch(value: string, rules: ForbiddenLivePath[]): ForbiddenLivePath | null {
  const normalized = value.replaceAll("\\", "/");
  for (const rule of rules) {
    const prefix = literalGlobPrefix(rule.path);
    if (!prefix) continue;
    const boundary = new RegExp(`(?:^|[^A-Za-z0-9_.-])${escapeRegExp(prefix)}(?=$|[/#?\\s'\"\`])`);
    if (boundary.test(normalized)) return rule;
  }
  return null;
}

function locationAt(source: string, index: number): { line: number; column: number } {
  const before = source.slice(0, Math.max(0, index));
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function nodeText(node: ts.Node): string | null {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function calleeName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return "";
}

function codeCandidates(path: string, source: string): Array<{ value: string; index: number }> {
  const kind = path.endsWith("x") ? ts.ScriptKind.TSX : path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs")
    ? ts.ScriptKind.JS
    : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const candidates: Array<{ value: string; index: number }> = [];
  const add = (node: ts.Node, value: string | null): void => {
    if (value !== null) candidates.push({ value, index: node.getStart(file) });
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      add(node, nodeText(node));
    }
    if (ts.isTemplateExpression(node)) {
      add(node.head, node.head.text);
      for (const span of node.templateSpans) add(span.literal, span.literal.text);
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (/^(?:join|resolve)$/.test(name)) {
        const segments = node.arguments.map(nodeText).filter((value): value is string => value !== null);
        if (segments.length > 0) add(node.arguments[0] ?? node, segments.join("/"));
      }
    } else if (ts.isNewExpression(node) && calleeName(node.expression) === "URL") {
      add(node.arguments?.[0] ?? node, node.arguments?.[0] ? nodeText(node.arguments[0]) : null);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return candidates;
}

function jsonCandidates(path: string, source: string): Array<{ value: string; index: number }> {
  const file = ts.parseJsonText(path, source);
  const candidates: Array<{ value: string; index: number }> = [];
  const visit = (node: ts.Node, parent?: ts.Node): void => {
    if (ts.isStringLiteral(node)) {
      candidates.push({ value: node.text, index: node.getStart(file) });
    }
    ts.forEachChild(node, (child) => visit(child, node));
  };
  visit(file);
  return candidates;
}

function yamlCandidates(source: string): Array<{ value: string; index: number }> {
  const values: string[] = [];
  try {
    yaml.loadAll(source, (document) => {
      const visit = (value: unknown): void => {
        if (typeof value === "string") values.push(value);
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") {
          for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            values.push(key);
            visit(nested);
          }
        }
      };
      visit(document);
    });
  } catch {
    return [];
  }
  let cursor = 0;
  return values.map((value) => {
    const index = source.indexOf(value, cursor);
    if (index >= 0) cursor = index + value.length;
    return { value, index: Math.max(0, index) };
  });
}

function scriptCandidates(path: string, source: string): Array<{ value: string; index: number }> {
  const masked = path.endsWith(".ps1")
    ? source.replace(/<#[\s\S]*?#>/g, (comment) => comment.replace(/[^\r\n]/g, " "))
    : source;
  const candidates: Array<{ value: string; index: number }> = [];
  let offset = 0;
  for (const line of masked.split(/(?<=\n)/)) {
    const content = line.replace(/[\r\n]+$/, "");
    if (/\.(?:bat|cmd)$/.test(path) && /^\s*(?:rem(?:\s|$)|::)/i.test(content)) {
      offset += line.length;
      continue;
    }
    for (let index = 0; index < content.length;) {
      const character = content[index];
      if (character === "#" && !/\.(?:bat|cmd)$/.test(path)) break;
      if (character !== "'" && character !== '"') {
        index += 1;
        continue;
      }
      const quote = character;
      const start = index;
      index += 1;
      let value = "";
      while (index < content.length) {
        const next = content[index];
        if (next === quote) break;
        if (next === "\\" && index + 1 < content.length) {
          value += `${next}${content[index + 1]}`;
          index += 2;
          continue;
        }
        if (next === "`" && index + 1 < content.length) {
          value += content[index + 1];
          index += 2;
          continue;
        }
        value += next;
        index += 1;
      }
      if (index < content.length && content[index] === quote) {
        candidates.push({ value, index: offset + start + 1 });
        index += 1;
      }
    }
    offset += line.length;
  }
  return candidates;
}

function uncommented(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if ((character === "\\" || character === "`") && index + 1 < line.length) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "#") {
      return line.slice(0, index);
    }
  }
  return line;
}

function textConfigCandidates(path: string, source: string): Array<{ value: string; index: number }> {
  const candidates = scriptCandidates(path, source);
  const name = path.split("/").at(-1) ?? path;
  let offset = 0;
  for (const line of source.split(/(?<=\n)/)) {
    const live = uncommented(line.replace(/[\r\n]+$/, ""));
    const values: Array<{ value: string; start: number }> = [];
    const equals = live.indexOf("=");
    if (name.startsWith(".env") && equals >= 0) {
      values.push({ value: live.slice(equals + 1), start: equals + 1 });
    } else if (TOML_EXTENSION.test(name) && equals >= 0) {
      values.push({ value: live.slice(0, equals), start: 0 });
      values.push({ value: live.slice(equals + 1), start: equals + 1 });
    } else {
      values.push({ value: live, start: 0 });
    }
    for (const value of values) {
      const tokenPattern = /[^\s=,\[\]{}]+/g;
      for (const match of value.value.matchAll(tokenPattern)) {
        const token = match[0].replace(/^["']|["']$/g, "");
        if (!token || match[0].startsWith('"') || match[0].startsWith("'")) continue;
        candidates.push({ value: token, index: offset + value.start + (match.index ?? 0) });
      }
    }
    offset += line.length;
  }
  return candidates;
}

export function scanForbiddenConsumers(input: {
  root: string;
  trackedPaths: string[];
  policy: GovernancePolicy;
  diagnosticPaths: Set<string> | null;
}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const rawPath of input.trackedPaths) {
    const path = normalizeRepoPath(rawPath);
    if (!consumerSurface(path) || excluded(path)) continue;
    if (input.diagnosticPaths && !input.diagnosticPaths.has(path)) continue;
    if (!CODE_EXTENSION.test(path) && !STRUCTURED_EXTENSION.test(path) && !SCRIPT_EXTENSION.test(path) && !textConfig(path)) continue;
    const absolute = join(input.root, ...path.split("/"));
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf8");
    const candidates = CODE_EXTENSION.test(path)
      ? codeCandidates(path, source)
      : textConfig(path)
        ? textConfigCandidates(path, source)
        : SCRIPT_EXTENSION.test(path)
        ? scriptCandidates(path, source)
        : path.endsWith(".yaml") || path.endsWith(".yml")
          ? yamlCandidates(source)
          : jsonCandidates(path, source);
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const forbidden = forbiddenMatch(candidate.value, input.policy.forbiddenLivePaths);
      if (!forbidden) continue;
      const key = `${forbidden.path}\0${candidate.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push({
        ruleId: "content/forbidden-consumer",
        severity: "error",
        path,
        location: locationAt(source, candidate.index),
        evidence: `Runtime/config/test consumer contains a live reference matching forbidden path ${forbidden.path}.`,
        remediation: `Route the consumer to ${forbidden.replacement} and remove the live legacy dependency.`,
        owner: forbidden.owner,
      });
    }
  }
  return diagnostics;
}
