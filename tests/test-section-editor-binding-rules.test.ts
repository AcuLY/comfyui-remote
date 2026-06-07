import test from "node:test";
import assert from "node:assert/strict";

import {
  canSwitchSectionPresetVariant,
  expandSectionPresetBindingDisplayRows,
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

test("section preset list expands preset group members into separate rows", () => {
  const rows = expandSectionPresetBindingDisplayRows(
    [
      {
        bindingId: "group-binding",
        presetName: "单人-背手站立",
        sourceId: null,
        variantId: null,
        presetGroupId: "group-section",
        categoryId: "group-cat",
        categoryName: "小节",
        categoryColor: "30 50% 55%",
        blockCount: 1,
        loraCount: 0,
        availableVariants: [],
      },
    ],
    {
      categories: [
        {
          id: "group-cat",
          name: "小节",
          color: "30 50% 55%",
          presets: [],
          groups: [
            {
              id: "group-section",
              name: "单人-背手站立",
              members: [
                {
                  id: "member-person",
                  presetId: "preset-person",
                  variantId: "variant-person-default",
                  subGroupId: null,
                  presetName: "单人",
                  variantName: "默认",
                },
                {
                  id: "member-pose",
                  presetId: "preset-pose",
                  variantId: "variant-pose-default",
                  subGroupId: null,
                  presetName: "背手站立",
                  variantName: "默认",
                },
              ],
            },
          ],
        },
        {
          id: "person-cat",
          name: "人数",
          color: "23 50% 55%",
          presets: [
            {
              id: "preset-person",
              name: "单人",
              variants: [{ id: "variant-person-default", name: "默认" }],
            },
          ],
        },
        {
          id: "pose-cat",
          name: "姿势",
          color: "258 50% 55%",
          presets: [
            {
              id: "preset-pose",
              name: "背手站立",
              variants: [{ id: "variant-pose-default", name: "默认" }],
            },
          ],
        },
      ],
    },
  );

  assert.deepEqual(
    rows.map((row) => ({
      key: row.key,
      name: row.presetName,
      sourceId: row.sourceId,
      variantId: row.variantId,
      categoryName: row.categoryName,
      isPresetGroupMember: row.isPresetGroupMember,
      parentPresetGroupName: row.parentPresetGroupName,
    })),
    [
      {
        key: "group-binding:member-person",
        name: "单人",
        sourceId: "preset-person",
        variantId: "variant-person-default",
        categoryName: "人数",
        isPresetGroupMember: true,
        parentPresetGroupName: "单人-背手站立",
      },
      {
        key: "group-binding:member-pose",
        name: "背手站立",
        sourceId: "preset-pose",
        variantId: "variant-pose-default",
        categoryName: "姿势",
        isPresetGroupMember: true,
        parentPresetGroupName: "单人-背手站立",
      },
    ],
  );
});
