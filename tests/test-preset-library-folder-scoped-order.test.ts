import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/server/repositories/preset-view-repository.ts", "utf8");

test("preset library orders presets and groups by folder-scoped order", () => {
  assert.match(
    source,
    /import\s+\{\s*buildFolderScopedItemOrder\s*\}\s+from\s+"@\/lib\/folder-navigation";/,
    "preset library must use the shared folder-scoped ordering helper",
  );
  assert.match(
    source,
    /const\s+orderedPresets\s*=\s*buildFolderScopedItemOrder\(\s*c\.folders\s*,\s*c\.presets\s*\)/,
    "preset library presets must be flattened by folder order before mapping",
  );
  assert.match(
    source,
    /const\s+orderedGroups\s*=\s*buildFolderScopedItemOrder\(\s*c\.folders\s*,\s*c\.groups\s*\)/,
    "preset library groups must be flattened by folder order before mapping",
  );
});
