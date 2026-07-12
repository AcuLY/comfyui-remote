import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadMetadataValidator } from "../scripts/docs/check/config";
import { parseMarkdownDocument } from "../scripts/docs/check/markdown";

const ROOT = process.cwd();
const TSX = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function run(root: string, script: string, args: string[] = []) {
  return spawnSync(process.execPath, [TSX, join(ROOT, script), ...args], { cwd: root, encoding: "utf8" });
}

function git(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

test("repository inventory generator has an exact non-writing check mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "repo-inventory-check-"));
  try {
    await mkdir(join(root, "scripts", "docs"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n");
    git(root, "init", "--quiet");
    git(root, "config", "user.name", "Generator Test");
    git(root, "config", "user.email", "generator@example.invalid");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "baseline");

    const write = run(root, "scripts/docs/generate-repo-inventory.ts");
    assert.equal(write.status, 0, write.stderr);
    const outputPath = join(root, "docs", "repo-inventory.md");
    const before = await readFile(outputPath, "utf8");
    assert.deepEqual(
      loadMetadataValidator(ROOT).validate("existing-generator", parseMarkdownDocument("docs/repo-inventory.md", before).metadata),
      [],
    );
    const check = run(root, "scripts/docs/generate-repo-inventory.ts", ["--check"]);
    assert.equal(check.status, 0, check.stderr);
    assert.equal(await readFile(outputPath, "utf8"), before);

    await writeFile(join(root, "new-file.txt"), "tracked\n");
    git(root, "add", "new-file.txt");
    const stale = run(root, "scripts/docs/generate-repo-inventory.ts", ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /is stale/);
    assert.equal(await readFile(outputPath, "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Prisma compatibility generator check mode never repairs drift", async () => {
  const root = await mkdtemp(join(tmpdir(), "prisma-doc-check-"));
  try {
    await mkdir(join(root, "prisma"), { recursive: true });
    await cp(join(ROOT, "prisma", "schema.prisma"), join(root, "prisma", "schema.prisma"));
    await cp(join(ROOT, "prisma", "schema.sqlite.prisma"), join(root, "prisma", "schema.sqlite.prisma"));
    const write = run(root, "scripts/docs/generate-prisma-schema-compatibility.ts");
    assert.equal(write.status, 0, write.stderr);
    const outputPath = join(root, "docs", "prisma-schema-compatibility.md");
    const generated = await readFile(outputPath, "utf8");
    assert.deepEqual(
      loadMetadataValidator(ROOT).validate(
        "existing-generator",
        parseMarkdownDocument("docs/prisma-schema-compatibility.md", generated).metadata,
      ),
      [],
    );
    const check = run(root, "scripts/docs/generate-prisma-schema-compatibility.ts", ["--check"]);
    assert.equal(check.status, 0, check.stderr);
    assert.equal(await readFile(outputPath, "utf8"), generated);

    await writeFile(outputPath, `${generated}\nmanual drift\n`);
    const drifted = await readFile(outputPath, "utf8");
    const stale = run(root, "scripts/docs/generate-prisma-schema-compatibility.ts", ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /is stale/);
    assert.equal(await readFile(outputPath, "utf8"), drifted);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
