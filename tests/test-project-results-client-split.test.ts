import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const routePath = "src/app/projects/[projectId]/results/project-results-client.tsx";
const filterHookPath = "src/app/projects/[projectId]/results/use-project-results-filter-state.ts";
const toolbarPath = "src/app/projects/[projectId]/results/project-results-toolbar.tsx";
const galleryPath = "src/app/projects/[projectId]/results/project-results-gallery.tsx";
const lightboxPath = "src/app/projects/[projectId]/results/project-results-lightbox.tsx";

test("project results filter state lives in a focused route hook", () => {
  assert.ok(existsSync(filterHookPath), `${filterHookPath} should own project results filter state`);

  const routeSource = readFileSync(routePath, "utf8");
  const hookSource = readFileSync(filterHookPath, "utf8");

  assert.match(hookSource, /export function useProjectResultsFilterState/);
  assert.match(hookSource, /useState<ProjectResultFilter>\("all"\)/);
  assert.match(hookSource, /filterProjectResultSections/);

  assert.match(routeSource, /from "\.\/use-project-results-filter-state";/);
  assert.doesNotMatch(routeSource, /const \[resultFilter,\s*setResultFilter\] = useState<ProjectResultFilter>\("all"\)/);
  assert.doesNotMatch(routeSource, /const filteredSections = useMemo/);
});

test("project results toolbar rendering lives in a focused component", () => {
  assert.ok(existsSync(toolbarPath), `${toolbarPath} should own project results toolbar rendering`);

  const routeSource = readFileSync(routePath, "utf8");
  const toolbarSource = readFileSync(toolbarPath, "utf8");

  assert.match(toolbarSource, /export function ProjectResultsToolbar/);
  assert.match(toolbarSource, /PROJECT_RESULT_FILTER_OPTIONS/);
  assert.match(toolbarSource, /data-result-filter=\{option\.value\}/);

  assert.match(routeSource, /from "\.\/project-results-toolbar";/);
  assert.doesNotMatch(routeSource, /function ProjectResultFilterControl/);
  assert.doesNotMatch(routeSource, /function ProjectResultFilterIcon/);
});

test("project results gallery rendering lives in a focused component", () => {
  assert.ok(existsSync(galleryPath), `${galleryPath} should own project results gallery rendering`);

  const routeSource = readFileSync(routePath, "utf8");
  const gallerySource = readFileSync(galleryPath, "utf8");

  assert.match(gallerySource, /export function ProjectResultsGallery/);
  assert.match(gallerySource, /function ResultImageCard/);
  assert.match(gallerySource, /function SectionResultsBlock/);

  assert.match(routeSource, /from "\.\/project-results-gallery";/);
  assert.doesNotMatch(routeSource, /function ResultImageCard/);
  assert.doesNotMatch(routeSource, /function SectionResultsBlock/);
});

test("project results lightbox shell lives in a focused component", () => {
  assert.ok(existsSync(lightboxPath), `${lightboxPath} should own project results lightbox rendering`);

  const routeSource = readFileSync(routePath, "utf8");
  const lightboxSource = readFileSync(lightboxPath, "utf8");

  assert.match(lightboxSource, /export function ProjectResultsLightbox/);
  assert.match(lightboxSource, /data-project-results-lightbox/);
  assert.match(lightboxSource, /<QuickCensorCanvas/);

  assert.match(routeSource, /from "\.\/project-results-lightbox";/);
  assert.doesNotMatch(routeSource, /data-project-results-lightbox/);
  assert.doesNotMatch(routeSource, /<QuickCensorCanvas/);
});
