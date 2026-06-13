import test from "node:test";
import assert from "node:assert/strict";

import { buildPresetGroupNameFromMembers } from "../src/app/assets/presets/group-utils";

test("preset group name fill ignores empty slot member drafts", () => {
  const name = buildPresetGroupNameFromMembers([
    { slotCategoryId: "cat-person", displayName: "Person" },
    { presetId: "preset-pose", variantId: "variant-pose", displayName: "Pose" },
    { subGroupId: "group-style", displayName: "Style Combo" },
    { presetId: "preset-empty", variantId: "variant-empty", displayName: "   " },
  ]);

  assert.equal(name, "pose-style-combo");
});
