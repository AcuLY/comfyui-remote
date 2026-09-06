import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";

import type { GitChange } from "./model";
import { normalizeRepoPath } from "./path";

const MAX_GIT_OUTPUT = 128 * 1024 * 1024;

function runGitBuffer(root: string, args: string[], allowFailure = false): Buffer | null {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: MAX_GIT_OUTPUT,
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (allowFailure) {
      return null;
    }
    throw new Error(`git ${args[0] ?? "command"} failed (${result.status}): ${result.stderr?.toString("utf8").trim()}`);
  }
  return result.stdout ?? Buffer.alloc(0);
}

function nulStrings(buffer: Buffer): string[] {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

export function repositoryRoot(root: string): string {
  const value = runGitBuffer(root, ["rev-parse", "--show-toplevel"]);
  return value!.toString("utf8").trim();
}

export function listTrackedPaths(root: string): string[] {
  return nulStrings(runGitBuffer(root, ["ls-files", "-z"])!)
    .map(normalizeRepoPath)
    .sort();
}

export function resolveComparison(root: string, base?: string): {
  requestedBase: string | null;
  mergeBase: string | null;
  changes: GitChange[];
} {
  if (!base) {
    return { requestedBase: null, mergeBase: null, changes: [] };
  }
  if (base.startsWith("-") || !/^[A-Za-z0-9._/@{}^~:+-]+$/.test(base)) {
    throw new Error(`Unsafe Git comparison revision: ${base}`);
  }
  const commit = runGitBuffer(root, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${base}^{commit}`], true);
  if (!commit) {
    throw new Error(`Explicit Git comparison revision does not resolve to a commit: ${base}`);
  }
  const merge = runGitBuffer(root, ["merge-base", commit.toString("utf8").trim(), "HEAD"], true);
  if (!merge) {
    throw new Error(`Explicit Git comparison revision has no merge base with HEAD: ${base}`);
  }
  const mergeBase = merge.toString("utf8").trim();
  const tokens = nulStrings(runGitBuffer(root, ["diff", "--name-status", "-z", "--find-renames", mergeBase, "--"])!);
  const changes: GitChange[] = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!status) break;
    if (/^[RC]/.test(status)) {
      const oldPath = tokens[index++];
      const path = tokens[index++];
      if (!oldPath || !path) throw new Error("Git returned an incomplete rename/copy record.");
      changes.push({ status, oldPath: normalizeRepoPath(oldPath), path: normalizeRepoPath(path) });
    } else {
      const path = tokens[index++];
      if (!path) throw new Error("Git returned an incomplete change record.");
      changes.push({ status, path: normalizeRepoPath(path) });
    }
  }
  return { requestedBase: base, mergeBase, changes };
}

function addBuffer(hash: ReturnType<typeof createHash>, label: string, value: Buffer): void {
  hash.update(label);
  hash.update("\0");
  hash.update(String(value.length));
  hash.update("\0");
  hash.update(value);
  hash.update("\0");
}

export async function captureWorktreeSnapshot(root: string): Promise<string> {
  const hash = createHash("sha256");
  addBuffer(hash, "status", runGitBuffer(root, ["status", "--porcelain=v2", "-z", "--untracked-files=all"])!);
  addBuffer(hash, "working", runGitBuffer(root, ["diff", "--binary", "--no-ext-diff", "--"])!);
  addBuffer(hash, "staged", runGitBuffer(root, ["diff", "--cached", "--binary", "--no-ext-diff", "--"])!);

  const untracked = nulStrings(runGitBuffer(root, ["ls-files", "--others", "--exclude-standard", "-z"])!)
    .map(normalizeRepoPath)
    .sort();
  for (const path of untracked) {
    const absolute = join(root, ...path.split("/"));
    const stat = lstatSync(absolute);
    hash.update(`untracked\0${path}\0${stat.mode}\0`);
    if (stat.isSymbolicLink()) {
      hash.update(`symlink\0${readlinkSync(absolute)}\0`);
    } else if (stat.isFile()) {
      addBuffer(hash, `file:${path}`, readFileSync(absolute));
    }
  }
  return hash.digest("hex");
}
