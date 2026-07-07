import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sharedPath = "src/app/assets/model-file-manager-shared.ts";
const managerPaths = [
  "src/app/assets/models/model-file-manager.tsx",
  "src/app/assets/loras/lora-file-manager.tsx",
];

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test("model and LoRA file managers share identical browse helpers", () => {
  assert.ok(existsSync(sharedPath), `${sharedPath} should own shared file-manager browse helpers`);

  const sharedSource = readSource(sharedPath);
  assert.match(sharedSource, /export type AssetBrowseItem/);
  assert.match(sharedSource, /export type AssetBrowseResult/);
  assert.match(sharedSource, /export function formatAssetFileSize/);
  assert.match(sharedSource, /export function assetPathSegments/);

  for (const managerPath of managerPaths) {
    const managerSource = readSource(managerPath);
    assert.match(
      managerSource,
      /from "\.\.\/model-file-manager-shared";/,
      `${managerPath} should import shared browse helpers`,
    );
    assert.match(managerSource, /formatAssetFileSize/);
    assert.match(managerSource, /assetPathSegments/);
    assert.doesNotMatch(managerSource, /function formatSize/);
    assert.doesNotMatch(managerSource, /function pathSegments/);
    assert.doesNotMatch(managerSource, /type BrowseResult =/);
  }
});
