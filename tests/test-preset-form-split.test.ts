import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const formPath = "src/app/assets/presets/preset-form.tsx";
const variantListPath = "src/app/assets/presets/preset-variant-list.tsx";

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
