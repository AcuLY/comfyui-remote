import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const visibleTextareaFiles = [
  "src/components/prompt-block-editor.tsx",
  "src/components/template-prompt-block-editor.tsx",
  "src/app/assets/presets/preset-form.tsx",
  "src/app/assets/presets/preset-variant-bulk-edit-dialog.tsx",
  "src/app/assets/templates/template-form-client.tsx",
  "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx",
  "src/app/assets/models/model-file-manager.tsx",
  "src/app/assets/loras/lora-file-manager.tsx",
  "src/app/projects/new/project-form.tsx",
  "src/app/projects/[projectId]/edit/project-edit-form.tsx",
];

test("visible text-editing textareas opt into the shared mobile editor height", () => {
  for (const file of visibleTextareaFiles) {
    assert.match(readSource(file), /cm-text-editor/, `${file} should use the shared text editor height class`);
  }
});

test("global text editor height class keeps mobile editors taller than the row defaults", () => {
  const css = readSource("src/app/globals.css");

  assert.match(css, /\.cm-text-editor\s*{[\s\S]*min-height:\s*7rem/, "default text editor height should be at least 7rem");
  assert.match(css, /\.cm-text-editor--compact\s*{[\s\S]*min-height:\s*5rem/, "compact editors should still be taller than one row");
  assert.match(css, /@media\s*\(max-width:\s*639px\)\s*{[\s\S]*\.cm-text-editor\s*{[\s\S]*min-height:\s*clamp\(9rem,\s*34dvh,\s*13rem\)/, "mobile editors should use the taller responsive minimum");
});

test("design-demo multiline Field follows the same mobile height scale", () => {
  const css = readSource("src/components/design-demo-ui/primitives/field/field.module.css");

  assert.match(css, /\.multilineControl\s*{[\s\S]*min-height:\s*120px/, "shared Field multiline control should be taller by default");
  assert.match(css, /@media\s*\(max-width:\s*639px\)\s*{[\s\S]*\.multilineControl\s*{[\s\S]*min-height:\s*clamp\(144px,\s*34dvh,\s*208px\)/, "shared Field multiline control should be taller on mobile");
});
