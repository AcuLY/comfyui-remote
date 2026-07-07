import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRISMA_SCHEMA_PATHS,
  readPrismaModelBlock,
} from "./fixtures/prisma-schema-source";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("LoraAsset schema stores one Civitai link for model files", () => {
  for (const schemaFile of PRISMA_SCHEMA_PATHS) {
    const modelSource = readPrismaModelBlock(schemaFile, "LoraAsset");
    assert.match(modelSource, /^\s*civitaiLink\s+String\?\s*$/m, `${schemaFile} declares civitaiLink`);
  }
});

test("model notes endpoint accepts and persists the Civitai link", () => {
  const routeSource = readSource("src/app/api/models/notes/route.ts");
  const legacyLoraRouteSource = readSource("src/app/api/loras/notes/route.ts");
  const serviceSource = readSource("src/server/services/model-asset-service.ts");

  assert.match(routeSource, /civitaiLink:\s*z\.string\(\)\.optional\(\)/, "model notes route validates civitaiLink");
  assert.match(legacyLoraRouteSource, /civitaiLink:\s*z\.string\(\)\.optional\(\)/, "legacy LoRA notes route validates civitaiLink");
  assert.match(serviceSource, /select:\s*\{[\s\S]*?civitaiLink:\s*true/, "asset reads include civitaiLink");
  assert.match(serviceSource, /update:\s*\{[\s\S]*?civitaiLink/, "upsert update persists civitaiLink");
  assert.match(serviceSource, /create:\s*\{[\s\S]*?civitaiLink/, "upsert create persists civitaiLink");
  assert.match(serviceSource, /return\s+\{[\s\S]*?civitaiLink:\s*asset\.civitaiLink/, "save response returns civitaiLink");
});

test("model file manager exposes desktop detail and mobile accordion model info", () => {
  const source = readSource("src/app/assets/models/model-file-manager.tsx");
  const sharedSource = readSource("src/app/assets/model-file-manager-shared.ts");

  assert.match(sharedSource, /civitaiLink\?:\s*string/, "browse item includes civitaiLink");
  assert.match(source, /selectedFilePath/, "desktop model info panel tracks selected file");
  assert.match(source, /<aside[\s\S]*模型信息/, "desktop side panel renders model information");
  assert.match(source, /aria-expanded=\{expandedFilePath === (?:item|fileItem)\.path\}/, "mobile file cards expose accordion state");
  assert.match(source, /target="_blank"[\s\S]*rel="noreferrer"/, "Civitai link opens safely");
});
