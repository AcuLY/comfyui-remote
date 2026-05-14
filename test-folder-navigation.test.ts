import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFolderScopedItemOrder,
  hrefWithFolderQuery,
} from "./src/lib/folder-navigation";

const folders = [
  { id: "folder-a", name: "A", parentId: null, sortOrder: 0 },
  { id: "folder-a-child", name: "A1", parentId: "folder-a", sortOrder: 0 },
  { id: "folder-b", name: "B", parentId: null, sortOrder: 1 },
];

test("buildFolderScopedItemOrder follows folder rows before direct items across nested folders", () => {
  const items = [
    { id: "root-item", folderId: null },
    { id: "a-child-item", folderId: "folder-a-child" },
    { id: "b-item", folderId: "folder-b" },
    { id: "a-item", folderId: "folder-a" },
  ];

  assert.deepEqual(
    buildFolderScopedItemOrder(folders, items).map((item) => item.id),
    ["a-child-item", "a-item", "b-item", "root-item"],
  );
});

test("buildFolderScopedItemOrder keeps direct item order within the same folder", () => {
  const items = [
    { id: "a-2", folderId: "folder-a" },
    { id: "a-1", folderId: "folder-a" },
    { id: "root", folderId: null },
  ];

  assert.deepEqual(
    buildFolderScopedItemOrder(folders, items).map((item) => item.id),
    ["a-2", "a-1", "root"],
  );
});

test("hrefWithFolderQuery preserves folder context before hash fragments", () => {
  assert.equal(
    hrefWithFolderQuery("/projects/project-1", "sectionFolder", "folder-a", "section-s1"),
    "/projects/project-1?sectionFolder=folder-a#section-s1",
  );
  assert.equal(
    hrefWithFolderQuery("/projects", "folder", null),
    "/projects",
  );
});
