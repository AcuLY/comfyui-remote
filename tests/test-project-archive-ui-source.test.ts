import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("generation project archive UI is wired through the existing archive service", () => {
  const actions = readSource("src/lib/actions/project.ts");
  const archiveButton = readSource("src/app/projects/project-archive-button.tsx");
  const archiveService = readSource("src/server/services/project-archive-service.ts");
  const archiveDoc = readSource("docs/product/generation/project-archive.md");
  const projectList = readSource("src/app/projects/projects-client.tsx");
  const listRepository = readSource("src/server/repositories/project-view-repository/list-view.ts");
  const types = readSource("src/lib/types.ts");

  assert.match(actions, /archiveProject as archiveProjectService/);
  assert.match(actions, /export async function archiveProject\(projectId: string\)/);
  assert.match(actions, /archiveProjectService\(projectId\)/);
  assert.match(actions, /safeRevalidatePath\("\/projects"\)/);

  assert.match(archiveButton, /Archive/);
  assert.match(archiveButton, /archiveProject\(projectId\)/);
  assert.match(archiveButton, /项目已归档/);
  assert.match(archiveButton, /归档项目/);
  assert.match(archiveButton, /await archiveProject\(projectId\);/);
  assert.doesNotMatch(archiveButton, /(?:const|let)\s+\w+\s*=\s*await archiveProject\(projectId\)/);
  assert.match(archiveDoc, /当前 `ProjectArchiveButton` 丢弃该返回值/);
  assert.match(projectList, /已归档 · 文件已清理/);
  assert.match(archiveDoc, /只是当前乐观界面状态，不是全部文件已删除的证据/);

  const managedCleanup = archiveService.slice(
    archiveService.indexOf("// 4. Delete managed image directory"),
    archiveService.indexOf("// 5. Delete ComfyUI output directories"),
  );
  assert.match(managedCleanup, /resolveDataPath\("images", project\.slug\)/);
  assert.match(managedCleanup, /rm\(managedImageDir, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(managedCleanup, /isPathInsideDirectory/);
  assert.match(archiveDoc, /没有再次调用 `isPathInsideDirectory` 做路径包含关系校验/);

  assert.match(projectList, /ProjectArchiveButton/);
  assert.match(projectList, /showArchived/);
  assert.match(projectList, /project\.archivedAt/);

  assert.match(listRepository, /publishedAt: true/);
  assert.match(listRepository, /archivedAt: true/);
  assert.match(listRepository, /publishedAt: project\.publishedAt \? formatDate\(project\.publishedAt\) : null/);
  assert.match(listRepository, /archivedAt: project\.archivedAt \? formatDate\(project\.archivedAt\) : null/);

  assert.match(types, /publishedAt\?: string \| null/);
  assert.match(types, /archivedAt\?: string \| null/);
});

test("project create and destructive controls import focused project actions", () => {
  const archiveButton = readSource("src/app/projects/project-archive-button.tsx");
  const deleteButton = readSource("src/app/projects/project-delete-button.tsx");
  const projectForm = readSource("src/app/projects/new/project-form.tsx");

  assert.match(archiveButton, /from "@\/lib\/actions\/project";/);
  assert.match(deleteButton, /from "@\/lib\/actions\/project";/);
  assert.match(projectForm, /from "@\/lib\/actions\/project";/);
  assert.doesNotMatch(archiveButton, /from "@\/lib\/actions";/);
  assert.doesNotMatch(deleteButton, /from "@\/lib\/actions";/);
  assert.doesNotMatch(projectForm, /from "@\/lib\/actions";/);
});

test("project list imports folder actions from focused module", () => {
  const projectList = readSource("src/app/projects/projects-client.tsx");

  assert.match(projectList, /from "@\/lib\/actions\/project-folder";/);
  assert.doesNotMatch(projectList, /from "@\/lib\/actions";/);
});
