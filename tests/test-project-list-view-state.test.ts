import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const modelPath = "src/app/projects/project-list-view-model.ts";
const hookPath = "src/app/projects/use-project-list-view-state.ts";
const clientSource = readFileSync("src/app/projects/projects-client.tsx", "utf8");

const baseProject = {
  presetNames: [],
  status: "draft" as const,
  updatedAt: "2026-07-07",
  sectionCount: 0,
};

const folders = [
  { id: "root-a", name: "Root A", parentId: null, sortOrder: 1, projectCount: 0, childCount: 1 },
  { id: "child-a", name: "Child A", parentId: "root-a", sortOrder: 1, projectCount: 0, childCount: 0 },
  { id: "root-b", name: "Root B", parentId: null, sortOrder: 2, projectCount: 0, childCount: 0 },
];

const projects = [
  { ...baseProject, id: "active-root", title: "Active root", folderId: null },
  { ...baseProject, id: "archived-root", title: "Archived root", folderId: null, archivedAt: "2026-07-01" },
  { ...baseProject, id: "active-child", title: "Active child", folderId: "child-a" },
];

test("project list view model resolves folders projects archive filter and breadcrumb", async () => {
  assert.ok(existsSync(modelPath), `${modelPath} should own project list view derivation`);

  const { resolveProjectListView } = await import("../src/app/projects/project-list-view-model");

  const rootView = resolveProjectListView({
    projects,
    folders,
    currentFolderId: null,
    showArchived: false,
  });

  assert.deepEqual(rootView.visibleFolders.map((folder) => folder.id), ["root-a", "root-b"]);
  assert.deepEqual(rootView.visibleProjects.map((project) => project.id), ["active-root"]);
  assert.deepEqual(rootView.countableProjects.map((project) => project.id), ["active-root", "active-child"]);
  assert.equal(rootView.archivedProjectCount, 1);
  assert.deepEqual(rootView.breadcrumb, []);

  const childView = resolveProjectListView({
    projects,
    folders,
    currentFolderId: "child-a",
    showArchived: true,
  });

  assert.deepEqual(childView.visibleFolders, []);
  assert.deepEqual(childView.visibleProjects.map((project) => project.id), ["active-child"]);
  assert.deepEqual(childView.countableProjects.map((project) => project.id), ["active-root", "archived-root", "active-child"]);
  assert.deepEqual(childView.breadcrumb.map((folder) => folder.id), ["root-a", "child-a"]);
});

test("projects client delegates list filter and selection state to the project hook", () => {
  assert.ok(existsSync(hookPath), `${hookPath} should own project list UI state`);
  assert.match(clientSource, /useProjectListViewState/);
  assert.doesNotMatch(clientSource, /import \{[^}]*\buseMemo\b[^}]*\} from "react"/);
  assert.doesNotMatch(clientSource, /const visibleProjects = useMemo/);
  assert.doesNotMatch(clientSource, /const visibleFolders = useMemo/);
  assert.doesNotMatch(clientSource, /const breadcrumb = useMemo/);
});
