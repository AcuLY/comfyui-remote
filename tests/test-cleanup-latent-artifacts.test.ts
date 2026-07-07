import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("cleanup latent artifacts prints exact deletion plan before deleting", async () => {
  const root = await mkdtemp(join(tmpdir(), "latent-cleanup-"));
  const topLatentsDir = join(root, "project-a", "latents");
  const nestedLatentsDir = join(root, "project-b", "nested", "latents");
  const latentFile = join(root, "project-c", "orphan.latent");
  const regularFile = join(root, "project-c", "keep.txt");

  await mkdir(topLatentsDir, { recursive: true });
  await mkdir(nestedLatentsDir, { recursive: true });
  await mkdir(join(root, "project-c"), { recursive: true });
  await writeFile(join(topLatentsDir, "inside.latent"), "remove by directory");
  await writeFile(join(nestedLatentsDir, "inside.txt"), "remove by directory");
  await writeFile(latentFile, "remove by suffix");
  await writeFile(regularFile, "keep");

  const result = spawnSync(process.execPath, ["scripts/cleanup-latent-artifacts.mjs", root], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(lines.length, 2, "cleanup should print a plan line before the summary line");

  assert.deepEqual(lines[0], {
    action: "cleanup-latent-artifacts-plan",
    roots: [resolve(root)],
    delete: {
      directories: [resolve(nestedLatentsDir), resolve(topLatentsDir)].sort(),
      files: [resolve(latentFile)],
    },
  });
  assert.deepEqual(lines[1], {
    roots: 1,
    latentDirectories: 2,
    latentFiles: 1,
  });
  assert.equal(existsSync(topLatentsDir), false);
  assert.equal(existsSync(nestedLatentsDir), false);
  assert.equal(existsSync(latentFile), false);
  assert.equal(existsSync(regularFile), true);
});

test("cleanup latent artifacts logs the deletion plan before filesystem removal calls", () => {
  const source = readFileSync("scripts/cleanup-latent-artifacts.mjs", "utf8");
  const planLogIndex = source.indexOf('action: "cleanup-latent-artifacts-plan"');
  const deleteIndex = source.indexOf("await deletePlannedLatentArtifacts");

  assert.notEqual(planLogIndex, -1, "cleanup script should build and log a deletion plan");
  assert.notEqual(deleteIndex, -1, "cleanup script should delete from the logged plan");
  assert.ok(planLogIndex < deleteIndex, "deletion plan must be logged before deletion starts");
});
