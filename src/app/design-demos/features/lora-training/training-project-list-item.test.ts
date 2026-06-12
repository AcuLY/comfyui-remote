import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const itemSource = readFileSync(resolve(testDir, "training-project-list-item.tsx"), "utf8");
const projectsPageSource = readFileSync(resolve(testDir, "training-projects-page.tsx"), "utf8");
const projectsCss = readFileSync(resolve(testDir, "training-projects-page.module.css"), "utf8");

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

test("training project card body uses thumbnails without inline result-count summaries", () => {
  const bodyStart = itemSource.indexOf("body={(");
  assert.notEqual(bodyStart, -1, "Project card should define an explicit body region");

  const bodyRegion = itemSource.slice(bodyStart, itemSource.indexOf("className={s.projectMeta}", bodyStart));

  assert.match(bodyRegion, /ImageListSmall/, "Body should use the recent-result thumbnail strip");
  assert.doesNotMatch(bodyRegion, /showCounts/, "Thumbnail strip should not reintroduce business summary counts");
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
