import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE,
  normalizeSourceImageUploadRole,
} from "../src/lib/character-lora-source-images";

const repoRoot = process.cwd();
const helperSource = readFileSync(resolve(repoRoot, "src/lib/character-lora-source-images.ts"), "utf8");
const trainingProjectRepositorySource = readFileSync(
  resolve(repoRoot, "src/server/repositories/training/projects.ts"),
  "utf8",
);

test("Character LoRA source image uploads retain legacy role compatibility by normalizing to source", () => {
  assert.equal(CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE, "source");

  for (const legacyRole of [
    undefined,
    null,
    "",
    "source",
    "reference",
    "face",
    "full_body",
    "outfit",
    "pose",
    1,
    { role: "reference" },
  ]) {
    assert.equal(normalizeSourceImageUploadRole(legacyRole), CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE);
  }
});

test("Character LoRA source image compatibility helper remains documented and used by uploads", () => {
  assert.match(
    helperSource,
    /Keep accepting legacy role values from old forms\/API clients/,
    "The helper should explain why legacy role inputs still normalize instead of being rejected.",
  );
  assert.match(
    trainingProjectRepositorySource,
    /normalizeSourceImageUploadRole\(formData\.get\("role"\)\)/,
    "Training reference uploads should accept legacy role form fields through the compatibility helper.",
  );
  assert.doesNotMatch(
    trainingProjectRepositorySource,
    /const role = normalizeNullableString\(formData\.get\("role"\)\) \?\? TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE/,
    "Training reference uploads should not store legacy role form values verbatim.",
  );
});
