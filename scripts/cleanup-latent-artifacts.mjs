#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

async function cleanupPath(path, summary) {
  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(path, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "latents") {
        await rm(entryPath, { recursive: true, force: true });
        summary.latentDirectories += 1;
        continue;
      }

      await cleanupPath(entryPath, summary);
      continue;
    }

    if (entry.name.endsWith(".latent")) {
      await rm(entryPath, { force: true });
      summary.latentFiles += 1;
    }
  }
}

async function main() {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    throw new Error("Usage: node scripts/cleanup-latent-artifacts.mjs <root> [root...]");
  }

  const summary = {
    roots: 0,
    latentDirectories: 0,
    latentFiles: 0,
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

    summary.roots += 1;
    await cleanupPath(rootPath, summary);
  }

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
