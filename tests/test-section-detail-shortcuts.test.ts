import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(file: string) {
  return readFileSync(join(rootDir, file), "utf8");
}

test("project section detail page wires s/f shortcuts to previous and next sections", () => {
  const pageSource = readSource("src/app/projects/[projectId]/sections/[sectionId]/page.tsx");
  const shortcutSource = readSource("src/app/projects/[projectId]/sections/[sectionId]/section-switch-navigation.tsx");

  assert.match(
    pageSource,
    /<SectionKeyboardShortcuts[\s\S]*prevSectionId=\{prevSection\?\.id \?\? null\}[\s\S]*nextSectionId=\{nextSection\?\.id \?\? null\}/,
    "section page should pass previous and next section ids into keyboard shortcuts",
  );
  assert.match(shortcutSource, /prevSectionId: string \| null/, "shortcut component should accept a previous section id");
  assert.match(shortcutSource, /nextSectionId: string \| null/, "shortcut component should accept a next section id");
  assert.match(
    shortcutSource,
    /const prevHref = prevSectionId \? `\/projects\/\$\{projectId\}\/sections\/\$\{prevSectionId\}` : null;/,
    "shortcut component should build previous section href",
  );
  assert.match(
    shortcutSource,
    /const nextHref = nextSectionId \? `\/projects\/\$\{projectId\}\/sections\/\$\{nextSectionId\}` : null;/,
    "shortcut component should build next section href",
  );
  assert.match(
    shortcutSource,
    /event\.key\.toLowerCase\(\) === "s"[\s\S]*\? prevHref/,
    "s should navigate to the previous section",
  );
  assert.match(
    shortcutSource,
    /event\.key\.toLowerCase\(\) === "f"[\s\S]*\? nextHref/,
    "f should navigate to the next section",
  );
  assert.match(
    shortcutSource,
    /saveSectionSwitchScroll\(projectId\)[\s\S]*window\.location\.assign\(href\)/,
    "s/f shortcuts should preserve scroll state before document navigation",
  );
  assert.match(
    shortcutSource,
    /target\.isContentEditable[\s\S]*tagName === "INPUT"[\s\S]*tagName === "TEXTAREA"[\s\S]*tagName === "SELECT"/,
    "shortcuts should be ignored while editing form controls",
  );
});
