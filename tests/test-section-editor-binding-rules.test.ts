import test from "node:test";
import assert from "node:assert/strict";

import {
  canSwitchSectionPresetVariant,
  getSectionPresetBindingDisplayName,
} from "../src/components/section-editor-binding-rules";

test("resolver-only preset bindings can still switch variants", () => {
  assert.equal(
    canSwitchSectionPresetVariant({
      presetGroupId: null,
      resolvedOnly: true,
      availableVariants: [
        { id: "variant-default", name: "Default" },
        { id: "variant-alt", name: "Alt" },
      ],
    }),
    true,
  );
});

test("preset groups and single-variant presets do not expose variant switching", () => {
  assert.equal(
    canSwitchSectionPresetVariant({
      presetGroupId: "group-1",
      resolvedOnly: false,
      availableVariants: [
        { id: "variant-default", name: "Default" },
        { id: "variant-alt", name: "Alt" },
      ],
    }),
    false,
  );

  assert.equal(
    canSwitchSectionPresetVariant({
      presetGroupId: null,
      resolvedOnly: false,
      availableVariants: [{ id: "variant-default", name: "Default" }],
    }),
    false,
  );
});

test("section preset list title omits the selected variant suffix", () => {
  assert.equal(
    getSectionPresetBindingDisplayName({
      presetName: "刻晴-霓裾翩跹 / 默认",
      variantId: "variant-default",
      availableVariants: [
        { id: "variant-default", name: "默认" },
        { id: "variant-alt", name: "内裤" },
      ],
    }),
    "刻晴-霓裾翩跹",
  );
});

test("section preset list title keeps slash text that is not the selected variant", () => {
  assert.equal(
    getSectionPresetBindingDisplayName({
      presetName: "Preset / Collection",
      variantId: "variant-default",
      availableVariants: [{ id: "variant-default", name: "默认" }],
    }),
    "Preset / Collection",
  );
});
