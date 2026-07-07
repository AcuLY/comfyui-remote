import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const clientPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx";
const promptBlocksPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-prompt-blocks.tsx";
const loraEditorPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-lora-editor.tsx";
const presetBindingsPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-preset-bindings.tsx";
const sectionFormPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-form.tsx";
const navigationPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-navigation.tsx";

test("template section detail delegates prompt block rendering to a focused component", () => {
  assert.ok(existsSync(promptBlocksPath), `${promptBlocksPath} should own template prompt block rendering`);

  const clientSource = readFileSync(clientPath, "utf8");
  const promptBlocksSource = readFileSync(promptBlocksPath, "utf8");

  assert.match(promptBlocksSource, /export function TemplateSectionPromptBlocks/);
  assert.match(promptBlocksSource, /<TemplatePromptBlockEditor/);
  assert.match(promptBlocksSource, /onDetachBinding/);
  assert.match(promptBlocksSource, /export type \{ TemplateBlockData \}/);

  assert.match(clientSource, /from "\.\/template-section-prompt-blocks";/);
  assert.doesNotMatch(clientSource, /<TemplatePromptBlockEditor/);
  assert.doesNotMatch(clientSource, /from "@\/components\/template-prompt-block-editor";/);
});

test("template section detail delegates LoRA rendering to a focused editor component", () => {
  assert.ok(existsSync(loraEditorPath), `${loraEditorPath} should own template section LoRA rendering`);

  const clientSource = readFileSync(clientPath, "utf8");
  const loraEditorSource = readFileSync(loraEditorPath, "utf8");

  assert.match(loraEditorSource, /export function TemplateSectionLoraEditor/);
  assert.match(loraEditorSource, /<LoraListEditor/);
  assert.match(loraEditorSource, /LoRA 1/);
  assert.match(loraEditorSource, /LoRA 2/);
  assert.match(loraEditorSource, /enableStandaloneDelete/);

  assert.match(clientSource, /from "\.\/template-section-lora-editor";/);
  assert.doesNotMatch(clientSource, /<LoraListEditor/);
  assert.doesNotMatch(clientSource, /from "@\/components\/lora-list-editor";/);
});

test("template section detail delegates preset binding rendering to a focused editor component", () => {
  assert.ok(existsSync(presetBindingsPath), `${presetBindingsPath} should own imported preset binding rendering`);

  const clientSource = readFileSync(clientPath, "utf8");
  const presetBindingsSource = readFileSync(presetBindingsPath, "utf8");

  assert.match(presetBindingsSource, /export function TemplateSectionPresetBindings/);
  assert.match(presetBindingsSource, /<ImportPresetPanel/);
  assert.match(presetBindingsSource, /onSwitchVariant/);
  assert.match(presetBindingsSource, /onDeleteBinding/);
  assert.match(presetBindingsSource, /onStandaloneDeleteBinding/);
  assert.match(presetBindingsSource, /<Package/);
  assert.match(presetBindingsSource, /<Download/);

  assert.match(clientSource, /from "\.\/template-section-preset-bindings";/);
  assert.doesNotMatch(clientSource, /<ImportPresetPanel/);
  assert.doesNotMatch(clientSource, /<Package/);
  assert.doesNotMatch(clientSource, /<Download/);
  assert.doesNotMatch(clientSource, /<Trash2/);
});

test("template section detail delegates section form rendering to a focused form component", () => {
  assert.ok(existsSync(sectionFormPath), `${sectionFormPath} should own template section form rendering`);

  const clientSource = readFileSync(clientPath, "utf8");
  const sectionFormSource = readFileSync(sectionFormPath, "utf8");

  assert.match(sectionFormSource, /export function TemplateSectionForm/);
  assert.match(sectionFormSource, /<CheckpointCascadePicker/);
  assert.match(sectionFormSource, /<AspectRatioPicker/);
  assert.match(sectionFormSource, /<BatchSizeQuickFill/);
  assert.match(sectionFormSource, /<UpscaleFactorQuickFill/);
  assert.match(sectionFormSource, /<KSamplerPanel/);
  assert.match(sectionFormSource, /使用二阶段 KSampler/);

  assert.match(clientSource, /from "\.\/template-section-form";/);
  assert.doesNotMatch(clientSource, /<CheckpointCascadePicker/);
  assert.doesNotMatch(clientSource, /<AspectRatioPicker/);
  assert.doesNotMatch(clientSource, /<BatchSizeQuickFill/);
  assert.doesNotMatch(clientSource, /<UpscaleFactorQuickFill/);
  assert.doesNotMatch(clientSource, /<KSamplerPanel/);
});

test("template section detail delegates navigation rendering to a focused header component", () => {
  assert.ok(existsSync(navigationPath), `${navigationPath} should own template section navigation rendering`);

  const clientSource = readFileSync(clientPath, "utf8");
  const navigationSource = readFileSync(navigationPath, "utf8");

  assert.match(navigationSource, /export function TemplateSectionNavigation/);
  assert.match(navigationSource, /<NeighborNavigation/);
  assert.match(navigationSource, /href=\{basePath\}/);
  assert.match(navigationSource, /onNavigateToSection/);

  assert.match(clientSource, /from "\.\/template-section-navigation";/);
  assert.doesNotMatch(clientSource, /<NeighborNavigation/);
  assert.doesNotMatch(clientSource, /from "@\/components\/neighbor-navigation";/);
  assert.doesNotMatch(clientSource, /<ArrowLeft/);
});

test("template section detail route client remains the orchestration container after renderer splits", () => {
  const clientSource = readFileSync(clientPath, "utf8");

  assert.match(clientSource, /<TemplateSectionNavigation/);
  assert.match(clientSource, /<TemplateSectionForm/);
  assert.match(clientSource, /<TemplateSectionPresetBindings/);
  assert.match(clientSource, /<TemplateSectionPromptBlocks/);
  assert.match(clientSource, /<TemplateSectionLoraEditor/);
  assert.doesNotMatch(clientSource, /ChangeHistory|change-history|变更记录/);
  assert.ok(clientSource.split("\n").length < 800, `${clientPath} should stay below the broad-client review threshold`);
});
