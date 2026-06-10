import test from "node:test";
import assert from "node:assert/strict";

import {
  canSwitchSectionPresetVariant,
  expandSectionPresetBindingDisplayRows,
  getSectionPresetMemberPresetHref,
  getSectionPresetBindingGroupName,
  getSectionPresetManagerHref,
  getSectionPresetRowCardHref,
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

test("legacy preset group containers and single-variant presets do not expose variant switching", () => {
  assert.equal(
    canSwitchSectionPresetVariant({
      presetGroupId: "group-1",
      resolvedOnly: false,
      availableVariants: [],
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

test("group-imported preset rows can still switch variants", () => {
  assert.equal(
    canSwitchSectionPresetVariant({
      presetGroupId: "group-1",
      resolvedOnly: false,
      availableVariants: [
        { id: "variant-default", name: "Default" },
        { id: "variant-alt", name: "Alt" },
      ],
    }),
    true,
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

test("section preset manager link opens the source preset group before member preset", () => {
  const href = getSectionPresetManagerHref(
    {
      sourceId: "preset-person",
      variantId: "variant-default",
      presetGroupId: "group-section",
      categoryId: "person-cat",
    },
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
              folderId: "group-folder",
              members: [],
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
              variants: [{ id: "variant-default", name: "默认" }],
            },
          ],
        },
      ],
    },
  );

  assert.equal(href, "/assets/preset-groups/group-section?category=group-cat&folder=group-folder");
});

test("section preset manager link keeps ordinary preset detail targets", () => {
  const href = getSectionPresetManagerHref(
    {
      sourceId: "preset-person",
      variantId: "variant-default",
      presetGroupId: null,
      categoryId: "person-cat",
    },
    {
      categories: [
        {
          id: "person-cat",
          name: "人数",
          color: "23 50% 55%",
          presets: [
            {
              id: "preset-person",
              name: "单人",
              folderId: "preset-folder",
              variants: [{ id: "variant-default", name: "默认" }],
            },
          ],
        },
      ],
    },
  );

  assert.equal(href, "/assets/presets/preset-person?category=person-cat&variant=variant-default&folder=preset-folder");
});

test("section preset group member rows split card and member-detail navigation", () => {
  const library = {
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
            folderId: "group-folder",
            members: [
              {
                id: "member-person",
                presetId: "preset-person",
                variantId: "variant-default",
                subGroupId: null,
                presetName: "单人",
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
            folderId: "preset-folder",
            variants: [{ id: "variant-default", name: "默认" }],
          },
        ],
      },
    ],
  };
  const [row] = expandSectionPresetBindingDisplayRows(
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
    library,
  );

  assert.equal(row.isPresetGroupMember, true);
  assert.equal(getSectionPresetRowCardHref(row, library), "/assets/preset-groups/group-section?category=group-cat&folder=group-folder");
  assert.equal(getSectionPresetMemberPresetHref(row, library), "/assets/presets/preset-person?category=person-cat&variant=variant-default&folder=preset-folder");
});

test("ordinary section preset rows do not expose a member-detail navigation target", () => {
  const library = {
    categories: [
      {
        id: "person-cat",
        name: "人数",
        color: "23 50% 55%",
        presets: [
          {
            id: "preset-person",
            name: "单人",
            folderId: "preset-folder",
            variants: [{ id: "variant-default", name: "默认" }],
          },
        ],
      },
    ],
  };
  const [row] = expandSectionPresetBindingDisplayRows(
    [
      {
        bindingId: "person-binding",
        presetName: "单人",
        sourceId: "preset-person",
        variantId: "variant-default",
        presetGroupId: null,
        categoryId: "person-cat",
        categoryName: "人数",
        categoryColor: "23 50% 55%",
        blockCount: 1,
        loraCount: 0,
        availableVariants: [{ id: "variant-default", name: "默认" }],
      },
    ],
    library,
  );

  assert.equal(row.isPresetGroupMember, false);
  assert.equal(getSectionPresetRowCardHref(row, library), null);
  assert.equal(getSectionPresetMemberPresetHref(row, library), null);
});

test("section rename group name follows preset group slot template order", () => {
  const name = getSectionPresetBindingGroupName(
    { presetGroupId: "group-section" },
    {
      categories: [
        {
          id: "group-cat",
          name: "小节",
          color: "30 50% 55%",
          slotTemplate: [
            { categoryId: "pose-cat", label: "姿势" },
            { categoryId: "person-cat", label: "人数" },
          ],
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
                  sortOrder: 0,
                },
                {
                  id: "member-pose",
                  presetId: "preset-pose",
                  variantId: "variant-pose-default",
                  subGroupId: null,
                  presetName: "背手站立",
                  variantName: "默认",
                  sortOrder: 1,
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

  assert.equal(name, "背手站立 · 单人");
});

test("section preset list expands preset group members in preset category order", () => {
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
                  id: "member-pose",
                  presetId: "preset-pose",
                  variantId: "variant-pose-default",
                  subGroupId: null,
                  presetName: "背手站立",
                  variantName: "默认",
                },
                {
                  id: "member-person",
                  presetId: "preset-person",
                  variantId: "variant-person-default",
                  subGroupId: null,
                  presetName: "单人",
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

test("section preset list expands preset group members in positive prompt order", () => {
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
          positivePromptOrder: 1,
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
          positivePromptOrder: 0,
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
    rows.map((row) => row.presetName),
    ["背手站立", "单人"],
  );
});

test("section preset list sorts ordinary preset bindings by positive prompt order", () => {
  const rows = expandSectionPresetBindingDisplayRows(
    [
      {
        bindingId: "person-binding",
        presetName: "单人",
        sourceId: "preset-person",
        variantId: "variant-person-default",
        presetGroupId: null,
        categoryId: "person-cat",
        categoryName: "人数",
        categoryColor: "23 50% 55%",
        blockCount: 1,
        loraCount: 0,
        availableVariants: [{ id: "variant-person-default", name: "默认" }],
      },
      {
        bindingId: "pose-binding",
        presetName: "背手站立",
        sourceId: "preset-pose",
        variantId: "variant-pose-default",
        presetGroupId: null,
        categoryId: "pose-cat",
        categoryName: "姿势",
        categoryColor: "258 50% 55%",
        blockCount: 1,
        loraCount: 0,
        availableVariants: [{ id: "variant-pose-default", name: "默认" }],
      },
    ],
    {
      categories: [
        {
          id: "person-cat",
          name: "人数",
          color: "23 50% 55%",
          positivePromptOrder: 1,
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
          positivePromptOrder: 0,
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
    rows.map((row) => row.presetName),
    ["背手站立", "单人"],
  );
});

test("section preset list keeps real group-imported preset bindings as independent rows", () => {
  const rows = expandSectionPresetBindingDisplayRows(
    [
      {
        bindingId: "member-binding",
        presetName: "鍗曚汉",
        sourceId: "preset-person",
        variantId: "variant-person-default",
        presetGroupId: "group-section",
        categoryId: "person-cat",
        categoryName: "浜烘暟",
        categoryColor: "23 50% 55%",
        blockCount: 1,
        loraCount: 0,
        availableVariants: [
          { id: "variant-person-default", name: "榛樿" },
          { id: "variant-person-alt", name: "鍙樹綋" },
        ],
      },
    ],
    {
      categories: [
        {
          id: "group-cat",
          name: "灏忚妭",
          color: "30 50% 55%",
          presets: [],
          groups: [
            {
              id: "group-section",
              name: "鍗曚汉-鑳屾墜绔欑珛",
              members: [
                {
                  id: "member-pose",
                  presetId: "preset-pose",
                  variantId: "variant-pose-default",
                  subGroupId: null,
                  presetName: "鑳屾墜绔欑珛",
                },
              ],
            },
          ],
        },
        {
          id: "person-cat",
          name: "浜烘暟",
          color: "23 50% 55%",
          presets: [
            {
              id: "preset-person",
              name: "鍗曚汉",
              variants: [
                { id: "variant-person-default", name: "榛樿" },
                { id: "variant-person-alt", name: "鍙樹綋" },
              ],
            },
          ],
        },
      ],
    },
  );

  assert.deepEqual(
    rows.map((row) => ({
      key: row.key,
      sourceId: row.sourceId,
      presetGroupId: row.binding.presetGroupId,
      isPresetGroupMember: row.isPresetGroupMember,
      availableVariantCount: row.availableVariants.length,
    })),
    [
      {
        key: "member-binding",
        sourceId: "preset-person",
        presetGroupId: "group-section",
        isPresetGroupMember: false,
        availableVariantCount: 2,
      },
    ],
  );
});
