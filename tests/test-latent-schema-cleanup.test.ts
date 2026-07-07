import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  PRISMA_SCHEMA_PATHS,
  readPrismaModelBlock,
} from "./fixtures/prisma-schema-source";

const execFileAsync = promisify(execFile);

test("Run schemas no longer include latentFilePath", async () => {
  for (const schemaPath of PRISMA_SCHEMA_PATHS) {
    const runModel = readPrismaModelBlock(schemaPath, "Run");

    assert.doesNotMatch(runModel, /latentFilePath/);
  }
});

test("cleanup script deletes only latent artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "latent-cleanup-"));
  const rawDir = join(root, "raw");
  const thumbDir = join(root, "thumbs");
  const censoredDir = join(root, "censored");
  const latentDir = join(root, "runs", "latents");
  const nestedDir = join(root, "nested");
  const safeDir = join(root, "not-latents");

  await Promise.all([
    mkdir(rawDir, { recursive: true }),
    mkdir(thumbDir, { recursive: true }),
    mkdir(censoredDir, { recursive: true }),
    mkdir(latentDir, { recursive: true }),
    mkdir(nestedDir, { recursive: true }),
    mkdir(safeDir, { recursive: true }),
  ]);

  const keepPaths = [
    join(rawDir, "image.jpg"),
    join(thumbDir, "image.webp"),
    join(censoredDir, "image.jpg"),
    join(nestedDir, "image.jpg"),
    join(safeDir, "image.jpg"),
  ];
  const deletePaths = [
    join(latentDir, "saved-latent.bin"),
    join(nestedDir, "saved.latent"),
  ];

  await Promise.all([...keepPaths, ...deletePaths].map((path) => writeFile(path, "x")));

  await execFileAsync(process.execPath, ["scripts/cleanup-latent-artifacts.mjs", root], {
    cwd: process.cwd(),
  });

  assert.equal(existsSync(latentDir), false, "latents directories should be deleted");
  assert.equal(existsSync(join(nestedDir, "saved.latent")), false, ".latent files should be deleted");

  for (const keepPath of keepPaths) {
    assert.equal(existsSync(keepPath), true, `${keepPath} should be preserved`);
  }

  await rm(root, { recursive: true, force: true });
});

test("cleanup script treats missing roots as no-op", async () => {
  const root = await mkdtemp(join(tmpdir(), "latent-cleanup-missing-"));
  const missingRoot = join(root, "missing");

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/cleanup-latent-artifacts.mjs", missingRoot],
      { cwd: process.cwd() },
    );
    const [plan, summary] = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)) as [
      { action: string; roots: string[]; delete: { directories: string[]; files: string[] } },
      { latentDirectories: number; latentFiles: number; roots: number },
    ];

    assert.deepEqual(plan, {
      action: "cleanup-latent-artifacts-plan",
      roots: [],
      delete: {
        directories: [],
        files: [],
      },
    });
    assert.deepEqual(summary, {
      roots: 0,
      latentDirectories: 0,
      latentFiles: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
