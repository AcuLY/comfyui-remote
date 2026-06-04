import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFolderScopedItemOrder,
  findNeighborItems,
} from "../src/lib/folder-navigation";

const folders = [
  { id: "folder-a", name: "A", parentId: null, sortOrder: 0 },
  { id: "folder-b", name: "B", parentId: null, sortOrder: 1 },
  { id: "folder-a-child", name: "A child", parentId: "folder-a", sortOrder: 0 },
  { id: "folder-a-child-deep", name: "A child deep", parentId: "folder-a-child", sortOrder: 0 },
  { id: "folder-b-child", name: "B child", parentId: "folder-b", sortOrder: 0 },
];

const items = [
  { id: "root-before-input", folderId: null },
  { id: "a-direct", folderId: "folder-a" },
  { id: "a-child-direct", folderId: "folder-a-child" },
  { id: "a-child-deep-direct", folderId: "folder-a-child-deep" },
  { id: "b-child-direct", folderId: "folder-b-child" },
  { id: "b-direct", folderId: "folder-b" },
  { id: "root-after-input", folderId: null },
];

test("buildFolderScopedItemOrder traverses nested folders depth-first before root leaves", () => {
  assert.deepEqual(
    buildFolderScopedItemOrder(folders, items).map((item) => item.id),
    [
      "a-child-deep-direct",
      "a-child-direct",
      "a-direct",
      "b-child-direct",
      "b-direct",
      "root-before-input",
      "root-after-input",
    ],
  );
});

test("findNeighborItems returns previous next and position in ordered items", () => {
  const orderedItems = buildFolderScopedItemOrder(folders, items);

  assert.deepEqual(findNeighborItems(orderedItems, "a-direct"), {
    previous: { id: "a-child-direct", folderId: "folder-a-child" },
    current: { id: "a-direct", folderId: "folder-a" },
    next: { id: "b-child-direct", folderId: "folder-b-child" },
    index: 2,
    total: 7,
  });
});

test("findNeighborItems handles first last and missing current edges", () => {
  const orderedItems = buildFolderScopedItemOrder(folders, items);

  assert.deepEqual(findNeighborItems(orderedItems, "a-child-deep-direct"), {
    previous: null,
    current: { id: "a-child-deep-direct", folderId: "folder-a-child-deep" },
    next: { id: "a-child-direct", folderId: "folder-a-child" },
    index: 0,
    total: 7,
  });

  assert.deepEqual(findNeighborItems(orderedItems, "root-after-input"), {
    previous: { id: "root-before-input", folderId: null },
    current: { id: "root-after-input", folderId: null },
    next: null,
    index: 6,
    total: 7,
  });

  assert.deepEqual(findNeighborItems(orderedItems, "missing-item"), {
    previous: null,
    current: null,
    next: null,
    index: -1,
    total: 7,
  });
});
