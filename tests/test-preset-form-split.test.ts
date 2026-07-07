import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const formPath = "src/app/assets/presets/preset-form.tsx";
const variantListPath = "src/app/assets/presets/preset-variant-list.tsx";
const variantEditorPath = "src/app/assets/presets/preset-variant-editor.tsx";
const actionFooterPath = "src/app/assets/presets/preset-form-action-footer.tsx";

test("preset form delegates variant list rendering and DnD wiring to a focused component", () => {
  assert.ok(existsSync(variantListPath), `${variantListPath} should own preset variant list rendering`);

  const formSource = readFileSync(formPath, "utf8");
  const listSource = readFileSync(variantListPath, "utf8");

  assert.match(listSource, /export function PresetVariantList/);
  assert.match(listSource, /function SortableVariantBar/);
  assert.match(listSource, /<DndContext/);
  assert.match(listSource, /<SortableContext/);
  assert.match(listSource, /onReorder/);

  assert.match(formSource, /from "\.\/preset-variant-list";/);
  assert.doesNotMatch(formSource, /function SortableVariantBar/);
  assert.doesNotMatch(formSource, /<DndContext/);
  assert.doesNotMatch(formSource, /<SortableContext/);
  assert.doesNotMatch(formSource, /useSortable/);
  assert.doesNotMatch(formSource, /rectSortingStrategy/);
  assert.doesNotMatch(formSource, /CSS\.Transform/);
});

test("preset form delegates current variant field editing to a focused editor component", () => {
  assert.ok(existsSync(variantEditorPath), `${variantEditorPath} should own current variant editor rendering`);

  const formSource = readFileSync(formPath, "utf8");
  const editorSource = readFileSync(variantEditorPath, "utf8");

  assert.match(editorSource, /export function PresetVariantEditor/);
  assert.match(editorSource, /function LinkedVariantsEditor/);
  assert.match(editorSource, /<LoraBindingEditor/);
  assert.match(editorSource, /<PresetVariantBulkEditDialog/);
  assert.match(editorSource, /<PresetChangeHistoryPanel/);
  assert.match(editorSource, /onApplyPromptToAllVariants/);
  assert.match(editorSource, /onApplyLoraToAllVariants/);

  assert.match(formSource, /from "\.\/preset-variant-editor";/);
  assert.doesNotMatch(formSource, /function LinkedVariantsEditor/);
  assert.doesNotMatch(formSource, /<LoraBindingEditor/);
  assert.doesNotMatch(formSource, /<PresetVariantBulkEditDialog/);
  assert.doesNotMatch(formSource, /<PresetChangeHistoryPanel/);
  assert.doesNotMatch(formSource, /function renderLoraApplyActions/);
});

test("preset form delegates autosave action status rendering to a focused footer component", () => {
  assert.ok(existsSync(actionFooterPath), `${actionFooterPath} should own preset form autosave action status rendering`);

  const formSource = readFileSync(formPath, "utf8");
  const footerSource = readFileSync(actionFooterPath, "utf8");

  assert.match(footerSource, /export function PresetFormActionFooter/);
  assert.match(footerSource, /自动保存/);
  assert.match(footerSource, /Loader2/);
  assert.match(footerSource, /CheckCircle2/);
  assert.match(footerSource, /AlertTriangle/);
  assert.match(footerSource, /onRetry/);

  assert.match(formSource, /from "\.\/preset-form-action-footer";/);
  assert.doesNotMatch(formSource, /Loader2/);
  assert.doesNotMatch(formSource, /CheckCircle2/);
  assert.doesNotMatch(formSource, /AlertTriangle/);
  assert.doesNotMatch(formSource, /自动保存/);
});
