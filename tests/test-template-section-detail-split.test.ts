import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const clientPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx";
const promptBlocksPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-prompt-blocks.tsx";
const loraEditorPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-lora-editor.tsx";

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
