import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PROVIDER ??= "sqlite";
process.env.DATABASE_URL ??= "file:./data/test-project-folder-api.db";

let normalizeCreateProjectFolderBody: typeof import("./src/server/services/project-folder-service").normalizeCreateProjectFolderBody;
let normalizeMoveProjectToFolderBody: typeof import("./src/server/services/project-folder-service").normalizeMoveProjectToFolderBody;
let normalizeRenameProjectFolderBody: typeof import("./src/server/services/project-folder-service").normalizeRenameProjectFolderBody;
let normalizeReorderProjectFoldersBody: typeof import("./src/server/services/project-folder-service").normalizeReorderProjectFoldersBody;
let normalizeProjectUpdateBody: typeof import("./src/server/services/project-service").normalizeProjectUpdateBody;

test.before(async () => {
  const projectFolderService = await import("./src/server/services/project-folder-service");
  const projectService = await import("./src/server/services/project-service");

  normalizeCreateProjectFolderBody = projectFolderService.normalizeCreateProjectFolderBody;
  normalizeMoveProjectToFolderBody = projectFolderService.normalizeMoveProjectToFolderBody;
  normalizeRenameProjectFolderBody = projectFolderService.normalizeRenameProjectFolderBody;
  normalizeReorderProjectFoldersBody = projectFolderService.normalizeReorderProjectFoldersBody;
  normalizeProjectUpdateBody = projectService.normalizeProjectUpdateBody;
});

test("normalizeCreateProjectFolderBody trims names and nullable parent ids", () => {
  assert.deepEqual(
    normalizeCreateProjectFolderBody({ parentId: " folder-1 ", name: " 角色 " }),
    { parentId: "folder-1", name: "角色" },
  );
  assert.deepEqual(
    normalizeCreateProjectFolderBody({ parentId: null, name: "Root" }),
    { parentId: null, name: "Root" },
  );
});

test("normalizeCreateProjectFolderBody rejects invalid folder names", () => {
  assert.throws(
    () => normalizeCreateProjectFolderBody({ parentId: null, name: " " }),
    /name is required/,
  );
});

test("normalizeRenameProjectFolderBody trims the folder name", () => {
  assert.deepEqual(
    normalizeRenameProjectFolderBody({ name: " 新名字 " }),
    { name: "新名字" },
  );
});

test("normalizeMoveProjectToFolderBody accepts null or a non-empty folder id", () => {
  assert.deepEqual(
    normalizeMoveProjectToFolderBody({ projectId: " project-1 ", folderId: " folder-2 " }),
    { projectId: "project-1", folderId: "folder-2" },
  );
  assert.deepEqual(
    normalizeMoveProjectToFolderBody({ projectId: "project-1", folderId: null }),
    { projectId: "project-1", folderId: null },
  );
});

test("normalizeReorderProjectFoldersBody validates ids", () => {
  assert.deepEqual(
    normalizeReorderProjectFoldersBody({ parentId: " parent-1 ", ids: [" a ", "b"] }),
    { parentId: "parent-1", ids: ["a", "b"] },
  );
  assert.throws(
    () => normalizeReorderProjectFoldersBody({ parentId: null, ids: ["a", " "] }),
    /ids must contain non-empty strings/,
  );
});

test("normalizeProjectUpdateBody supports moving a project between folders", () => {
  assert.deepEqual(normalizeProjectUpdateBody({ folderId: " folder-1 " }), {
    aspectRatio: undefined,
    batchSize: undefined,
    checkpointName: undefined,
    folderId: "folder-1",
  });
  assert.deepEqual(normalizeProjectUpdateBody({ folderId: null }), {
    aspectRatio: undefined,
    batchSize: undefined,
    checkpointName: undefined,
    folderId: null,
  });
});
