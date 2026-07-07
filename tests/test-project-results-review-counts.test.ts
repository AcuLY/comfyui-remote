import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("project results data exposes kept image counts", () => {
  const source = readSource("src/server/repositories/project-view-repository/detail-view.ts");

  assert.match(source, /keptCount: number/, "ProjectResultsData sections should include keptCount");
  assert.match(source, /let keptCount = 0/, "getProjectResults should aggregate kept images per section");
  assert.match(source, /if \(img\.reviewStatus === "kept"\) keptCount \+= 1/, "keptCount should come from kept review status");
  assert.match(source, /keptCount,\s*\n\s*pendingCount,/m, "serialized project results should return keptCount");
});

test("project results page shows kept and pending counts instead of total image counts", () => {
  const routeSource = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const toolbarSource = readSource("src/app/projects/[projectId]/results/project-results-toolbar.tsx");
  const filterHookSource = readSource("src/app/projects/[projectId]/results/use-project-results-filter-state.ts");

  assert.doesNotMatch(routeSource, /<span>\{section\.imageCount\} 张图片<\/span>/, "section summary should not display total image count");
  assert.doesNotMatch(routeSource, /<span>\{totalImages\} 张图片<\/span>/, "project header should not display total image count");
  assert.doesNotMatch(toolbarSource, /<span>\{totalImages\} 张图片<\/span>/, "project header should not display total image count");
  assert.match(filterHookSource, /const totalKept = sections\.reduce\(/, "project header should aggregate kept counts");
  assert.match(filterHookSource, /const totalPending = sections\.reduce\(/, "project header should aggregate pending counts");
  assert.match(toolbarSource, /\{totalKept\} 保留/, "project header should show kept count");
  assert.match(toolbarSource, /\{totalPending\} 待审/, "project header should show pending count");
  assert.match(routeSource, /\{section\.keptCount\} 保留/, "section summary should show kept count");
  assert.match(routeSource, /\{section\.pendingCount\} 待审/, "section summary should show pending count");
});

test("project results page filters by one result marker and hides sections without visible images", () => {
  const routeSource = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const toolbarSource = readSource("src/app/projects/[projectId]/results/project-results-toolbar.tsx");
  const filterHookSource = readSource("src/app/projects/[projectId]/results/use-project-results-filter-state.ts");

  assert.match(
    filterHookSource,
    /type ProjectResultFilter = "all" \| "featured" \| "featured2" \| "cover"/,
    "project results should model the marker filter as a single selected value",
  );
  assert.match(
    filterHookSource,
    /PROJECT_RESULT_FILTER_OPTIONS[\s\S]*value: "featured"[\s\S]*label: "p站"[\s\S]*value: "featured2"[\s\S]*label: "预览"[\s\S]*value: "cover"[\s\S]*label: "封面"/,
    "project results should expose p站, 预览, and 封面 filter choices",
  );
  assert.match(
    filterHookSource,
    /const \[resultFilter, setResultFilter\] = useState<ProjectResultFilter>\("all"\)/,
    "project results should keep one active filter in client state",
  );
  assert.match(
    filterHookSource,
    /function filterProjectResultSections\(/,
    "project results should derive display sections through a dedicated filter helper",
  );
  assert.match(
    filterHookSource,
    /\.filter\(\(section\) => section\.imageCount > 0\)/,
    "project results should remove sections that have no visible images after filtering",
  );
  assert.match(
    filterHookSource,
    /const filteredSections = useMemo\(\s*\(\) => filterProjectResultSections\(sections, resultFilter\),\s*\[sections, resultFilter\],\s*\)/,
    "project results should memoize sections filtered by the active marker",
  );
  assert.match(
    routeSource,
    /sections=\{filteredSections\}/,
    "the project results sidebar should receive the filtered section list",
  );
  assert.match(
    routeSource,
    /filteredSections\.map\(\(section\) =>/,
    "the project results grid should render only filtered non-empty sections",
  );
  assert.match(
    filterHookSource,
    /const filteredImages = useMemo\(/,
    "the project results lightbox should navigate within the filtered image set",
  );
  assert.match(
    toolbarSource,
    /data-result-filter=\{option\.value\}/,
    "filter controls should expose stable attributes for UI verification",
  );
});
