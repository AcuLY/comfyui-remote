import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const itemSource = readFileSync(resolve(testDir, "training-project-list-item.tsx"), "utf8");
const projectsPageSource = readFileSync(resolve(testDir, "training-projects-page.tsx"), "utf8");
const projectsCss = readFileSync(resolve(testDir, "training-projects-page.module.css"), "utf8");

test("training project list keeps the project-demo header hierarchy", () => {
  const headerStart = projectsPageSource.indexOf("<PageHeader");
  const headerEnd = projectsPageSource.indexOf("/>", headerStart);
  assert.notEqual(headerStart, -1, "Project list should render a PageHeader");
  assert.notEqual(headerEnd, -1, "Project list PageHeader should stay compact");

  const headerRegion = projectsPageSource.slice(headerStart, headerEnd);
  const toolbarStart = projectsPageSource.indexOf("className={s.projectToolbar}");
  const toolbarEnd = projectsPageSource.indexOf("</div>", projectsPageSource.indexOf("className={s.projectToolbarControls}"));
  const toolbarRegion = projectsPageSource.slice(toolbarStart, toolbarEnd);

  assert.match(headerRegion, /title="项目"/, "Project list title should match the shared navigation label");
  assert.match(headerRegion, /actions=/, "Project list should keep its primary creation action in the page header");
  assert.match(headerRegion, /href="\/training\/projects\/new"/, "Project header action should open the training project form");
  assert.doesNotMatch(headerRegion, /eyebrow=/, "Project list should not add a redundant LoRA Training eyebrow");
  assert.doesNotMatch(headerRegion, /subtitle=/, "Project list should not duplicate counts above the scope tabs");
  assert.doesNotMatch(toolbarRegion, /\/training\/projects\/new/, "Project workspace toolbar should not duplicate the primary create action");
});

test("training project card keeps the design-demo management controls first", () => {
  const checkboxIndex = itemSource.indexOf("<Checkbox");
  const dragHandleIndex = itemSource.indexOf("projectDragHandle");
  const titleIndex = itemSource.indexOf("projectTitleRow");

  assert.ok(checkboxIndex > -1, "Project card should expose a selectable management control");
  assert.ok(dragHandleIndex > -1, "Project card should expose a drag handle management control");
  assert.ok(
    checkboxIndex < titleIndex && dragHandleIndex < titleIndex,
    "Selection and drag controls should be leading controls before content",
  );
});

test("training project card title stays clean and leaves business summaries out of the header", () => {
  const titleStart = itemSource.indexOf("title={(");
  const bodyStart = itemSource.indexOf("body={(");
  assert.notEqual(titleStart, -1, "Project card should define an explicit title region");
  assert.notEqual(bodyStart, -1, "Project card should define an explicit body region");

  const titleRegion = itemSource.slice(titleStart, bodyStart);

  assert.match(titleRegion, /project\.title/, "Title region should include the project name");
  assert.match(titleRegion, /sectionCountLabel/, "Title region should include only the short section-count tag");
  assert.match(titleRegion, /Trash2/, "Title region should include the compact delete action");
  assert.doesNotMatch(titleRegion, /datasetVersion|imageCount|readiness|caption|latest/i);
});

test("training project card meta stays light like the existing project demo", () => {
  const metaStart = itemSource.indexOf("className={s.projectMeta}");
  assert.notEqual(metaStart, -1, "Project card should keep a bottom meta row");

  const metaRegion = itemSource.slice(metaStart, itemSource.indexOf("</div>", metaStart));

  assert.match(metaRegion, /project\.updatedAt/, "Meta should include the update time");
  assert.match(metaRegion, /StatusBadge/, "Meta should include one status badge");
  assert.doesNotMatch(metaRegion, /datasetVersion|imageCount|caption|readiness/i, "Meta should not stack dataset summaries");
});

test("training project card body reuses the project-demo thumbnail stats", () => {
  const bodyStart = itemSource.indexOf("body={(");
  assert.notEqual(bodyStart, -1, "Project card should define an explicit body region");

  const bodyRegion = itemSource.slice(bodyStart, itemSource.indexOf("className={s.projectMeta}", bodyStart));

  assert.match(bodyRegion, /ImageListSmall/, "Body should use the recent-result thumbnail strip");
  assert.match(bodyRegion, /showCounts/, "Thumbnail strip should expose the same lightweight image stats as the project demo");
  assert.doesNotMatch(bodyRegion, /datasetVersion|caption|readiness|latest/i, "Body should not reintroduce bespoke dataset summaries");
});

test("training project compact mode has an explicit dense surface and hides secondary content", () => {
  assert.match(projectsCss, /\.projectSurfaceCompact\b/, "Compact project view should define the surface class used by the page");
  assert.match(projectsCss, /\.projectCardCompact[\s\S]*?\.projectRecentResults[\s\S]*?display:\s*none/, "Compact project cards should hide thumbnails");
  assert.match(projectsCss, /\.projectCardCompact[\s\S]*?\.projectMeta[\s\S]*?display:\s*none/, "Compact project cards should hide bottom meta");
});

test("training project list creates projects through the implemented form route", () => {
  assert.match(projectsPageSource, /ButtonLink/, "Project toolbar should use a navigational button for new projects");
  assert.match(projectsPageSource, /href="\/training\/projects\/new"/, "New project action should open the training project form");
  assert.doesNotMatch(
    projectsPageSource,
    /新建训练项目入口已预览/,
    "New project action should not stay as a feedback-only placeholder now that the form exists",
  );
});

test("training project list archives and restores selected projects locally", () => {
  assert.match(projectsPageSource, /localProjects/, "Project scope tabs should render from local editable project state");
  assert.match(projectsPageSource, /setLocalProjects/, "Archive and restore actions should update local project state");
  assert.match(projectsPageSource, /handleToggleSelectedProjectArchive/, "Project list should define a selected archive/restore handler");
  assert.match(projectsPageSource, /status:\s*scope === "current" \? "archived" : "ready"/, "Handler should move selected projects between current and archived scopes");
  assert.match(projectsPageSource, /orderedProjects = orderTrainingProjectsByIds\(localProjects, orderedProjectIds\)/, "Visible project list should use sorted local project state");
  assert.match(projectsPageSource, /currentCount = localProjects/, "Current tab count should use local project state");
  assert.match(projectsPageSource, /archivedCount = localProjects/, "Archived tab count should use local project state");
  assert.match(projectsPageSource, /onClick=\{handleToggleSelectedProjectArchive\}/, "Batch archive button should call the local state handler");
  assert.match(projectsPageSource, /scope === "current" \? "归档" : "恢复"/, "Batch action label should match the active scope");
});

test("training project list deletes selected projects from local front-end state", () => {
  assert.match(projectsPageSource, /hiddenProjectIds/, "Project list should track locally removed project ids");
  assert.match(projectsPageSource, /setHiddenProjectIds/, "Project list delete actions should update hidden project state");
  assert.match(projectsPageSource, /handleRemoveSelectedProjects/, "Project list should define a shared selected delete handler");
  assert.match(projectsPageSource, /selectedVisibleIds/, "Batch delete should only remove selected projects visible in the active scope");
  assert.match(projectsPageSource, /onClick=\{handleRemoveSelectedProjects\}/, "Batch delete button should call the local delete handler");
  assert.match(projectsPageSource, /训练项目已从列表移除/, "Batch delete feedback should describe the local state change");
  assert.doesNotMatch(itemSource, /删除训练项目需要确认/, "Single project delete feedback should describe the local removal, not a confirmation placeholder");
  assert.doesNotMatch(projectsPageSource, /删除动作已预览/, "Project delete actions should not remain preview-only placeholders");
});

test("training project drag handles are wired to a local sortable project order", () => {
  assert.match(projectsPageSource, /orderedProjectIds/, "Project list should keep an explicit local project order");
  assert.match(projectsPageSource, /setOrderedProjectIds/, "Project reorder should update local order state");
  assert.match(projectsPageSource, /handleReorderProjects/, "Project list should define a reorder handler");
  assert.match(projectsPageSource, /visibleProjectIds/, "Project list should derive sortable ids from the visible scope");
  assert.match(projectsPageSource, /<SortableList items=\{visibleProjectIds\} onReorder=\{handleReorderProjects\}>/, "Visible project cards should be wrapped in the shared sortable list");
  assert.match(itemSource, /useDemoSortable\(project\.id\)/, "Project item should attach sortable behavior to each card");
  assert.match(itemSource, /handleProps/, "Project drag handle should receive sortable handle props");
  assert.match(itemSource, /ref=\{ref\}/, "Project item should apply sortable refs");
  assert.match(itemSource, /style=\{style\}/, "Project item should apply sortable transform styles");
});
