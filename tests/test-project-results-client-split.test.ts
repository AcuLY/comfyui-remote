import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const routePath = "src/app/projects/[projectId]/results/project-results-client.tsx";
const filterHookPath = "src/app/projects/[projectId]/results/use-project-results-filter-state.ts";

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
