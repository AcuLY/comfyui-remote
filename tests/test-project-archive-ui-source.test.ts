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
