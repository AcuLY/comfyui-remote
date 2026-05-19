import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const showcaseDir = resolve(testDir);
const componentPreviewsSource = readShowcaseSource("pages/component-previews.tsx");
const familySamplesSource = readShowcaseSource("pages/family-samples.tsx");
const previewKeysSource = readShowcaseSource("preview-keys.ts");
const registrySource = readShowcaseSource("registry.ts");

function readShowcaseSource(relativePath) {
  return readFileSync(resolve(showcaseDir, relativePath), "utf8");
}

function functionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${functionName} body should close`);
}

function jsxTagSource(source, componentName, label) {
  const pattern = new RegExp(`<${componentName}\\b[\\s\\S]*?label="${label}"[\\s\\S]*?\\/>`);
  const match = source.match(pattern);
  assert.ok(match, `${componentName} with label "${label}" should exist`);
  return match[0];
}

test("component primitive previews keep local state instead of no-op callbacks", () => {
  assert.match(componentPreviewsSource, /Checkbox:\s*\(\)\s*=>\s*<CheckboxPreview\s*\/>/);
  assert.match(componentPreviewsSource, /Field:\s*\(\)\s*=>\s*<FieldsPreview\s*\/>/);

  const checkboxPreviewSource = functionSource(componentPreviewsSource, "CheckboxPreview");
  assert.match(checkboxPreviewSource, /useState\(true\)/);
  assert.match(checkboxPreviewSource, /useState\(false\)/);
  assert.match(jsxTagSource(checkboxPreviewSource, "Checkbox", "已选择"), /onCheckedChange=\{setCheckedSelected\}/);
  assert.match(jsxTagSource(checkboxPreviewSource, "Checkbox", "未选择"), /onCheckedChange=\{setUncheckedSelected\}/);
  assert.doesNotMatch(checkboxPreviewSource, /onCheckedChange=\{noop\}/);

  const fieldsPreviewSource = functionSource(componentPreviewsSource, "FieldsPreview");
  assert.match(fieldsPreviewSource, /useState\("写实人像"\)/);
  assert.match(fieldsPreviewSource, /useState\("masterpiece, best quality, portrait"\)/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "名称"), /onChange=\{setName\}/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "Prompt"), /multiline/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "Prompt"), /features=\{\{ resize: true, clipboard: true \}\}/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "Prompt"), /onChange=\{setPrompt\}/);

  const specSectionPreviewSource = functionSource(componentPreviewsSource, "SpecSectionPreview");
  assert.match(specSectionPreviewSource, /const\s+\[\s*checkpoint\s*,\s*setCheckpoint\s*\]\s*=\s*useState\("realisticVision\.safetensors"\)/);
  assert.match(jsxTagSource(specSectionPreviewSource, "FloatingSelect", "模型"), /value=\{checkpoint\}/);
  assert.match(jsxTagSource(specSectionPreviewSource, "FloatingSelect", "模型"), /onChange=\{setCheckpoint\}/);
  assert.doesNotMatch(jsxTagSource(specSectionPreviewSource, "FloatingSelect", "模型"), /value="realisticVision\.safetensors"/);
});

test("showcase unit row and folder samples expose real visible interactions", () => {
  assert.match(componentPreviewsSource, /UnitRowShell:\s*\(\)\s*=>\s*<UnitRowShellPreview\s*\/>/);
  assert.match(componentPreviewsSource, /FolderBreadcrumb:\s*\(\)\s*=>\s*<FolderBreadcrumbPreview\s*\/>/);
  assert.match(componentPreviewsSource, /MoveTargetPicker:\s*\(\)\s*=>\s*<MoveTargetPickerPreview\s*\/>/);

  const componentUnitSource = functionSource(componentPreviewsSource, "UnitRowShellPreview");
  assert.match(componentUnitSource, /useState\(true\)/);
  assert.match(componentUnitSource, /onCheckedChange=\{setSelected\}/);
  assert.doesNotMatch(componentUnitSource, /onCheckedChange=\{noop\}/);

  const familyUnitSource = functionSource(familySamplesSource, "UnitItemsSample");
  assert.match(familyUnitSource, /const\s+\[\s*selectedProject\s*,\s*setSelectedProject\s*\]\s*=\s*useState\(true\)/);
  assert.match(familyUnitSource, /onCheckedChange=\{setSelectedProject\}/);
  assert.doesNotMatch(familyUnitSource, /onCheckedChange=\{\(\)\s*=>\s*undefined\}/);

  for (const functionName of ["FolderBreadcrumbPreview", "MoveTargetPickerPreview"]) {
    const previewSource = functionSource(componentPreviewsSource, functionName);
    assert.match(previewSource, /useState(?:<[^>]+>)?\(/, `${functionName} should keep local state`);
    assert.doesNotMatch(previewSource, /on(?:Navigate|Move)=\{noop\}/, `${functionName} should not wire primitive clicks to noop`);
  }

  const foldersSampleSource = functionSource(familySamplesSource, "FoldersSample");
  assert.match(foldersSampleSource, /useState(?:<[^>]+>)?\("realistic"\)/);
  assert.match(foldersSampleSource, /onNavigate=\{setActiveFolderId\}/);
  assert.match(foldersSampleSource, /onMove=\{setMoveTargetId\}/);
  assert.doesNotMatch(foldersSampleSource, /on(?:Navigate|Move)=\{\(\)\s*=>\s*undefined\}/);
});

test("unit-items adapter previews do not leave row checkboxes wired to noop", () => {
  assert.match(componentPreviewsSource, /ProjectListItem:\s*\(\{ data \}\)\s*=>\s*<ProjectListItemPreview data=\{data\}\s*\/>/);
  assert.match(componentPreviewsSource, /PresetLibraryItemRow:\s*\(\{ data \}\)\s*=>\s*<PresetLibraryItemRowPreview data=\{data\}\s*\/>/);

  const projectPreviewSource = functionSource(componentPreviewsSource, "ProjectListItemPreview");
  assert.match(projectPreviewSource, /useState\(true\)/);
  assert.match(projectPreviewSource, /selected=\{selected\}/);
  assert.match(projectPreviewSource, /onToggleSelected=\{\(\)\s*=>\s*setSelected\(\(current\)\s*=>\s*!current\)\}/);
  assert.doesNotMatch(projectPreviewSource, /onToggleSelected=\{noop\}/);

  const presetPreviewSource = functionSource(componentPreviewsSource, "PresetLibraryItemRowPreview");
  assert.match(presetPreviewSource, /useState\(true\)/);
  assert.match(presetPreviewSource, /checked=\{checked\}/);
  assert.match(presetPreviewSource, /onToggle=\{\(\)\s*=>\s*setChecked\(\(current\)\s*=>\s*!current\)\}/);
  assert.doesNotMatch(presetPreviewSource, /onToggle=\{noop\}/);
});

test("showcase pages do not wire visible controls to no-op callbacks", () => {
  assert.doesNotMatch(componentPreviewsSource, /\bnoop\b/);
  assert.doesNotMatch(componentPreviewsSource, /=>\s*undefined/);
  assert.doesNotMatch(familySamplesSource, /=>\s*undefined/);
});

test("preset sync showcase entries document durable non-noop interactions", () => {
  for (const componentName of [
    "PresetCopySyncPreview",
    "AutoSaveQueuePreview",
    "CivitaiLinkManagerPreview",
    "ApplyToAllVariantsPreview",
  ]) {
    assert.match(previewKeysSource, new RegExp(`"${componentName}"`), `${componentName} must have a preview key`);
    assert.match(componentPreviewsSource, new RegExp(`${componentName}:\\s*\\(\\)\\s*=>\\s*<${componentName}\\s*\\/>`), `${componentName} must render a dedicated preview`);
    assert.match(registrySource, new RegExp(`componentName:\\s*"${componentName}"`), `${componentName} must be listed in the registry`);
  }

  for (const reviewName of ["预设复制", "自动保存队列", "Civitai 链接", "应用到所有变体"]) {
    assert.match(registrySource, new RegExp(`reviewName:\\s*"${reviewName}"`), `${reviewName} should be visible with a Chinese review name`);
  }

  const presetCopySource = functionSource(componentPreviewsSource, "PresetCopySyncPreview");
  assert.match(presetCopySource, /useState\(\["写实人像",\s*"胶片风格"\]\)/);
  assert.match(presetCopySource, /function\s+handlePresetCopy\(/);
  assert.match(presetCopySource, /setCopiedPresets\(\(current\)\s*=>\s*\[/);
  assert.match(presetCopySource, /setCopyStatus\("已复制"\)/);
  assert.doesNotMatch(presetCopySource, /feedback=\{\{/);

  const autoSaveSource = functionSource(componentPreviewsSource, "AutoSaveQueuePreview");
  assert.match(autoSaveSource, /useState\(\[\s*\{\s*id:\s*"prompt"/);
  assert.match(autoSaveSource, /function\s+retryFailedSave\(/);
  assert.match(autoSaveSource, /setSaveQueue\(\(current\)\s*=>\s*current\.map/);
  assert.match(autoSaveSource, /status:\s*"saving"/);
  assert.doesNotMatch(autoSaveSource, /feedback=\{\{/);

  const civitaiSource = functionSource(componentPreviewsSource, "CivitaiLinkManagerPreview");
  assert.match(civitaiSource, /useState\("https:\/\/civitai\.com\/models\/2491032"\)/);
  assert.match(civitaiSource, /function\s+updateCivitaiLink\(/);
  assert.match(civitaiSource, /setCivitaiLink\(nextLink\)/);
  assert.match(civitaiSource, /setLinkState\(/);
  assert.doesNotMatch(civitaiSource, /feedback=\{\{/);

  const applySource = functionSource(componentPreviewsSource, "ApplyToAllVariantsPreview");
  assert.match(applySource, /useState\(\[/);
  assert.match(applySource, /function\s+applyPromptToAllVariants\(/);
  assert.match(applySource, /setVariants\(\(current\)\s*=>\s*current\.map/);
  assert.match(applySource, /prompt:\s*sourcePrompt/);
  assert.doesNotMatch(applySource, /feedback=\{\{/);
});

test("preset sync family sample exposes the same real state transitions", () => {
  const sampleSource = functionSource(familySamplesSource, "PresetPromptLoraSample");

  for (const identifier of [
    "handlePresetCopy",
    "retryFailedSave",
    "updateCivitaiLink",
    "applyPromptToAllVariants",
  ]) {
    assert.match(sampleSource, new RegExp(`function\\s+${identifier}\\(`), `PresetPromptLoraSample should include ${identifier}`);
  }

  assert.match(sampleSource, /setCopiedPresets\(\(current\)\s*=>\s*\[/);
  assert.match(sampleSource, /setSaveQueue\(\(current\)\s*=>\s*current\.map/);
  assert.match(sampleSource, /setCivitaiLink\(nextLink\)/);
  assert.match(sampleSource, /setVariants\(\(current\)\s*=>\s*current\.map/);
});
