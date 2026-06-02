import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

async function readSource(path: string) {
  return await readFile(resolve(process.cwd(), path), "utf8");
}

function extractRunModel(schema: string) {
  const match = schema.match(/model Run \{[\s\S]*?\n\}/);
  assert.ok(match, "Run model should exist");
  return match[0];
}

test("Run schemas no longer include latentFilePath", async () => {
  for (const schemaPath of ["prisma/schema.prisma", "prisma/schema.sqlite.prisma"]) {
    const runModel = extractRunModel(await readSource(schemaPath));

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
    const summary = JSON.parse(stdout) as {
      latentDirectories: number;
      latentFiles: number;
      roots: number;
    };

    assert.deepEqual(summary, {
      roots: 0,
      latentDirectories: 0,
      latentFiles: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
