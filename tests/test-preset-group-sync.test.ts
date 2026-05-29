import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  PRESET_GROUP_PLACEHOLDER_LABEL,
  buildPresetGroupPlaceholderCreateInput,
  canonicalPresetGroupBindingId,
  haveSamePresetGroupMemberSet,
  isPresetGroupPlaceholderBlock,
  sortConcreteGroupMembersForSection,
  sortSectionPromptBlocksByCategoryOrder,
} from "../src/lib/actions/preset-group-sync";

test("empty synced preset groups keep a placeholder prompt block with the same group binding", () => {
  const placeholder = buildPresetGroupPlaceholderCreateInput({
    sectionId: "section-1",
    groupBindingId: "grp:group-1:existing",
    sortOrder: 3,
  });

  assert.equal(placeholder.projectSectionId, "section-1");
  assert.equal(placeholder.type, "custom");
  assert.equal(placeholder.label, PRESET_GROUP_PLACEHOLDER_LABEL);
  assert.equal(placeholder.groupBindingId, "grp:group-1:existing");
  assert.equal(placeholder.bindingId, null);
  assert.equal(placeholder.sourceId, null);
  assert.equal(placeholder.variantId, null);
  assert.equal(placeholder.categoryId, null);
  assert.equal(placeholder.positive, "");
  assert.equal(placeholder.negative, null);
  assert.equal(placeholder.sortOrder, 3);
  assert.equal(isPresetGroupPlaceholderBlock(placeholder), true);
});

test("synced preset group members are ordered by preset category positive prompt order", () => {
  const members = [
    { presetId: "late", variantId: "v-late", positivePromptOrder: 30, label: "late" },
    { presetId: "early", variantId: "v-early", positivePromptOrder: 10, label: "early" },
    { presetId: "middle-a", variantId: "v-middle-a", positivePromptOrder: 20, label: "middle-a" },
    { presetId: "middle-b", variantId: "v-middle-b", positivePromptOrder: 20, label: "middle-b" },
    { presetId: "unknown", variantId: "v-unknown", positivePromptOrder: null, label: "unknown" },
  ];

  assert.deepEqual(
    sortConcreteGroupMembersForSection(members).map((member) => member.presetId),
    ["early", "middle-a", "middle-b", "late", "unknown"],
  );
  assert.deepEqual(members.map((member) => member.presetId), ["late", "early", "middle-a", "middle-b", "unknown"]);
});

test("legacy preset group instances match by member set even if the stored block order is stale", () => {
  const previousMembers = [
    { presetId: "person", variantId: "v-person" },
    { presetId: "pose", variantId: "v-pose" },
  ];
  const staleStoredBlocks = [
    { presetId: "pose", variantId: "v-pose" },
    { presetId: "person", variantId: "v-person" },
  ];

  assert.equal(haveSamePresetGroupMemberSet(previousMembers, staleStoredBlocks), true);
  assert.equal(haveSamePresetGroupMemberSet(previousMembers, staleStoredBlocks.slice(0, 1)), false);
});

test("legacy group binding ids are canonicalized with the source group id", () => {
  assert.equal(
    canonicalPresetGroupBindingId("group-1", "group-1776997192539-9dzj762"),
    "grp:group-1:group-1776997192539-9dzj762",
  );
  assert.equal(
    canonicalPresetGroupBindingId("group-1", "grp:group-1:1776997192539-9dzj762"),
    "grp:group-1:1776997192539-9dzj762",
  );
});

test("synced preset group members are interleaved with existing section blocks by category order", () => {
  const sorted = sortSectionPromptBlocksByCategoryOrder([
    { label: "lazy", categoryOrder: 0, sortOrder: 0 },
    { label: "person", categoryOrder: 1, sortOrder: 1 },
    { label: "pose", categoryOrder: 6, sortOrder: 4 },
    { label: "character", categoryOrder: 2, sortOrder: 2 },
    { label: "expression", categoryOrder: 4, sortOrder: 3 },
    { label: "scene", categoryOrder: 7, sortOrder: 5 },
    { label: "style", categoryOrder: 8, sortOrder: 6 },
  ]).map((block) => block.label);

  assert.deepEqual(sorted, [
    "lazy",
    "person",
    "character",
    "expression",
    "pose",
    "scene",
    "style",
  ]);
});
