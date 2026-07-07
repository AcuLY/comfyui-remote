#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

function uniqueSorted(paths) {
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

async function collectLatentArtifacts(path, plan) {
  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(path, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "latents") {
        plan.delete.directories.push(entryPath);
        continue;
      }

      await collectLatentArtifacts(entryPath, plan);
      continue;
    }

    if (entry.name.endsWith(".latent")) {
      plan.delete.files.push(entryPath);
    }
  }
}

async function deletePlannedLatentArtifacts(plan) {
  for (const directory of plan.delete.directories) {
    await rm(directory, { recursive: true, force: true });
  }

  for (const file of plan.delete.files) {
    await rm(file, { force: true });
  }

  return {
    roots: plan.roots.length,
    latentDirectories: plan.delete.directories.length,
    latentFiles: plan.delete.files.length,
  };
}

async function main() {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    throw new Error("Usage: node scripts/cleanup-latent-artifacts.mjs <root> [root...]");
  }

  const plan = {
    action: "cleanup-latent-artifacts-plan",
    roots: [],
    delete: {
      directories: [],
      files: [],
    },
  };

  for (const root of roots) {
    const rootPath = resolve(process.cwd(), root);
    let rootStats;
    try {
      rootStats = await stat(rootPath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    if (!rootStats.isDirectory()) {
      throw new Error(`Cleanup root is not a directory: ${rootPath}`);
    }

    plan.roots.push(rootPath);
    await collectLatentArtifacts(rootPath, plan);
  }

  plan.roots = uniqueSorted(plan.roots);
  plan.delete.directories = uniqueSorted(plan.delete.directories);
  plan.delete.files = uniqueSorted(plan.delete.files);

  console.log(JSON.stringify(plan));
  const summary = await deletePlannedLatentArtifacts(plan);
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
