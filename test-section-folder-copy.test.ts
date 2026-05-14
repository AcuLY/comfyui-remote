import test from "node:test";
import assert from "node:assert/strict";
import { buildTemplateSectionFolderClonePlan } from "./src/lib/actions/section-folder-utils";

test("buildTemplateSectionFolderClonePlan maps project section folders into template folders", () => {
  const plan = buildTemplateSectionFolderClonePlan({
    projectFolders: [
      { id: "root-a", name: "角色", parentId: null, sortOrder: 0 },
      { id: "child-a", name: "表情", parentId: "root-a", sortOrder: 0 },
      { id: "root-b", name: "场景", parentId: null, sortOrder: 1 },
    ],
    projectSections: [
      { id: "section-1", folderId: "child-a" },
      { id: "section-2", folderId: "root-b" },
      { id: "section-3", folderId: null },
    ],
    createFolderId: (folder) => `template-${folder.id}`,
  });

  assert.deepEqual(plan.foldersToCreate, [
    { sourceId: "root-a", id: "template-root-a", name: "角色", parentId: null, sortOrder: 0 },
    { sourceId: "child-a", id: "template-child-a", name: "表情", parentId: "template-root-a", sortOrder: 0 },
    { sourceId: "root-b", id: "template-root-b", name: "场景", parentId: null, sortOrder: 1 },
  ]);
  assert.deepEqual(plan.sectionFolderIdBySectionId, new Map([
    ["section-1", "template-child-a"],
    ["section-2", "template-root-b"],
    ["section-3", null],
  ]));
});
