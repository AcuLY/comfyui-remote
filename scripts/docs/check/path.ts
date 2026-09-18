import { posix, win32 } from "node:path";
import { Minimatch } from "minimatch";

export function normalizeRepoPath(input: string): string {
  if (input.includes("\0")) {
    throw new Error("Repository path contains NUL.");
  }
  const slashed = input.replaceAll("\\", "/");
  if (posix.isAbsolute(slashed) || win32.isAbsolute(input)) {
    throw new Error(`Repository path must not be absolute: ${input}`);
  }
  const normalized = posix.normalize(slashed).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Repository path escapes repository root: ${input}`);
  }
  if (normalized === ".") {
    return "";
  }
  return normalized;
}

const matcherCache = new Map<string, Minimatch>();

function matcher(pattern: string): Minimatch {
  const normalized = normalizeRepoPath(pattern);
  let value = matcherCache.get(normalized);
  if (!value) {
    value = new Minimatch(normalized, { dot: true, nocase: false, nocomment: true, nonegate: true });
    matcherCache.set(normalized, value);
  }
  return value;
}

export function matchesAny(path: string, patterns: string[]): boolean {
  const normalized = normalizeRepoPath(path);
  return patterns.some((pattern) => matcher(pattern).match(normalized));
}

export function matchesRule(path: string, include: string[], exclude: string[] = []): boolean {
  return matchesAny(path, include) && !matchesAny(path, exclude);
}

export function resolveRepoRelative(fromPath: string, target: string): { path: string; anchor: string | null } {
  const hashIndex = target.indexOf("#");
  const rawPath = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const rawAnchor = hashIndex >= 0 ? target.slice(hashIndex + 1) : null;
  const queryIndex = rawPath.indexOf("?");
  const withoutQuery = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
  let decodedPath: string;
  let decodedAnchor: string | null;
  try {
    decodedPath = decodeURI(withoutQuery);
    decodedAnchor = rawAnchor === null ? null : decodeURIComponent(rawAnchor);
  } catch {
    throw new Error(`Invalid percent encoding in Markdown target: ${target}`);
  }
  if (decodedPath.startsWith("/") || win32.isAbsolute(decodedPath)) {
    throw new Error(`Markdown target must be repository-relative: ${target}`);
  }
  const base = posix.dirname(normalizeRepoPath(fromPath));
  return {
    path: decodedPath === "" ? normalizeRepoPath(fromPath) : normalizeRepoPath(posix.join(base, decodedPath)),
    anchor: decodedAnchor,
  };
}

export function isExternalTarget(target: string): boolean {
  return target.startsWith("//") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target);
}

export function literalGlobPrefix(pattern: string): string {
  const index = pattern.search(/[?*{[]/);
  return (index < 0 ? pattern : pattern.slice(0, index)).replace(/\/+$/, "");
}
