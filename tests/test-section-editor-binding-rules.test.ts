import test from "node:test";
import assert from "node:assert/strict";

import { canSwitchSectionPresetVariant } from "../src/components/section-editor-binding-rules";

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
