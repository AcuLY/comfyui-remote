import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const clientPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx";
const promptBlocksPath = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-prompt-blocks.tsx";

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
