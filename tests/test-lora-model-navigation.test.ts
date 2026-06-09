import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("model asset selection href encodes kind and file path", async () => {
  const helperPath = "src/lib/model-asset-navigation.ts";
  assert.equal(existsSync(join(rootDir, helperPath)), true, "model asset navigation helper exists");

  const navigation = await import("../src/lib/model-asset-navigation");

  assert.equal(
    navigation.buildModelAssetSelectionHref("lora", "characters/miku v3.safetensors"),
    "/assets/models?kind=lora&path=characters%2Fmiku+v3.safetensors",
  );
  assert.equal(navigation.buildModelAssetSelectionHref("lora", ""), "/assets/models?kind=lora");
  assert.equal(navigation.modelSelectionDirectory("characters/miku-v3.safetensors"), "characters");
  assert.equal(navigation.modelSelectionDirectory("miku-v3.safetensors"), "");
});

test("LoRA rows link configured entries to the model asset manager", () => {
  const source = readSource("src/components/lora-list-editor.tsx");

  assert.match(source, /from "next\/link"/, "LoRA editor imports Next Link");
  assert.match(source, /buildModelAssetSelectionHref\("lora", entry\.path\)/, "LoRA row builds model selection href from entry path");
  assert.match(source, /href=\{modelAssetHref\}/, "LoRA row renders the href on a link");
});

test("model file manager selects the model requested by URL search params", () => {
  const pageSource = readSource("src/app/assets/models/page.tsx");
  const source = readSource("src/app/assets/models/model-file-manager.tsx");

  assert.match(pageSource, /searchParams:\s*Promise/, "models page reads async search params");
  assert.match(pageSource, /modelPathFromSearchParam/, "models page normalizes the requested model path");
  assert.match(pageSource, /<ModelFileManager initialKind=\{initialKind\} initialPath=\{initialPath\}/, "models page passes selection props to the client manager");
  assert.match(source, /modelSelectionDirectory\(selectedModelPath\)/, "model manager opens the selected file directory");
  assert.match(source, /fetchDir\(initialKind, initialPath, selectedModelPath\)/, "initial load passes the requested file to fetchDir");
  assert.match(source, /preferredSelectedPath/, "fetchDir prefers the requested file path when it exists");
});
