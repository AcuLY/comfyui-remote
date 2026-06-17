import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("preset detail saves existing variants with changed fields only", () => {
  const source = readSource("src/app/assets/presets/[presetId]/preset-edit-client.tsx");

  assert.match(
    source,
    /function variantPatchFromChange\(\s*before: VariantSaveData,\s*after: VariantSaveData,?\s*\)/,
    "preset detail should build a partial variant patch for existing variants",
  );
  assert.match(
    source,
    /stableJson\(before\.linkedVariants\) !== stableJson\(after\.linkedVariants\)[\s\S]*patch\.linkedVariants = after\.linkedVariants/,
    "linkedVariants should only be included when the linked variant list changed",
  );
  assert.match(
    source,
    /const variantPatch = variantPatchFromChange\(savedVariant\.data,\s*variantData\);[\s\S]*await updatePresetVariant\(savedVariant\.id,\s*variantPatch\)/,
    "existing variant updates should send the partial patch instead of the full variant data",
  );
  assert.doesNotMatch(
    source,
    /await updatePresetVariant\(savedVariant\.id,\s*variantData\)/,
    "LoRA or prompt-only saves should not send full variantData with linkedVariants",
  );
});

test("preset variant update skips unchanged linked variant replacements and asyncs history", () => {
  const source = readSource("src/lib/actions/preset-variant-crud.ts");
  const updateStart = source.indexOf("export async function updatePresetVariant");
  assert.notEqual(updateStart, -1, "updatePresetVariant should exist");
  const updateEnd = source.indexOf("\nexport async function deletePreset", updateStart);
  assert.notEqual(updateEnd, -1, "updatePresetVariant body should end before deletePreset");
  const updateBody = source.slice(updateStart, updateEnd);

  assert.match(
    source,
    /function linkedVariantRefsEqual\(/,
    "backend should be able to compare incoming linkedVariants to existing relation rows",
  );
  assert.match(
    updateBody,
    /const linkedRefs = linkedVariants !== undefined\s*\? normalizeLinkedVariantRefs\(linkedVariants\)\s*:\s*null/,
    "updatePresetVariant should normalize linkedVariants once for comparison",
  );
  assert.match(
    updateBody,
    /if \(linkedRefs && !linkedVariantRefsEqual\(beforeLinked\.linkedVariants,\s*linkedRefs\)\) \{[\s\S]*await replaceVariantLinks\(tx,\s*updated\.id,\s*linkedRefs\)/,
    "unchanged linkedVariants should not delete and recreate relation rows",
  );
  assert.match(
    updateBody,
    /recordPresetChangeInBackground\(/,
    "preset change history should be queued without blocking variant saves",
  );
  assert.doesNotMatch(
    updateBody,
    /await recordPresetChange\(/,
    "updatePresetVariant should not await change-history writes on the save path",
  );
});
