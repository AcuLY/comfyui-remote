import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

function readSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const sidebarSource = readSource("src/components/ui/sidebar.tsx");
const projectSidebarSource = readSource("src/app/projects/[projectId]/app-sidebar.tsx");

test("project detail can use a narrower persistent mobile sidebar without shrinking all sidebar sheets", () => {
  assert.match(
    sidebarSource,
    /mobileWidth\?:\s*string/,
    "Shared Sidebar should expose a page-level mobileWidth override",
  );
  assert.match(
    sidebarSource,
    /mobileWidth\s*=\s*SIDEBAR_WIDTH_MOBILE/,
    "Shared Sidebar should keep the existing default mobile sidebar width",
  );
  assert.match(
    sidebarSource,
    /"--sidebar-width"\s*:\s*mobileWidth/g,
    "Mobile sidebar branches should read the override instead of the global default directly",
  );
  assert.match(
    projectSidebarSource,
    /mobileWidth="7rem"/,
    "Project detail should reserve less horizontal space for the persistent mobile sidebar",
  );
});
