import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(file: string) {
  return readFileSync(join(rootDir, file), "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("preset and group detail server pages build DFS scoped neighbors", () => {
  const cases = [
    {
      file: "src/app/assets/presets/[presetId]/page.tsx",
      folderInput: "category.folders",
      itemInput: "category.presets",
      currentId: "presetId",
    },
    {
      file: "src/app/assets/preset-groups/[groupId]/page.tsx",
      folderInput: "category.folders",
      itemInput: "category.groups",
      currentId: "groupId",
    },
  ];

  for (const { file, folderInput, itemInput, currentId } of cases) {
    const source = readSource(file);

    assert.match(
      source,
      /from ["']@\/lib\/folder-navigation["']/,
      `${file} should import folder navigation helpers`,
    );
    assert.match(
      source,
      /\bbuildFolderScopedItemOrder\b/,
      `${file} should use buildFolderScopedItemOrder`,
    );
    assert.match(
      source,
      /\bfindNeighborItems\b/,
      `${file} should use findNeighborItems`,
    );
    assert.match(
      source,
      new RegExp(`buildFolderScopedItemOrder\\(\\s*${folderInput.replace(".", "\\.")}\\s*,\\s*${itemInput.replace(".", "\\.")}\\s*\\)`),
      `${file} should order items inside the current category's DFS folder scope`,
    );
    assert.match(
      source,
      new RegExp(`findNeighborItems\\(\\s*ordered\\w+\\s*,\\s*${currentId}\\s*\\)`),
      `${file} should find neighbors around the current route item`,
    );
  }
});

test("preset and group edit clients render shared neighbor navigation with hrefs and position text", () => {
  const cases = [
    {
      file: "src/app/assets/presets/[presetId]/preset-edit-client.tsx",
      previousProp: "previousPreset",
      nextProp: "nextPreset",
      indexProp: "presetPosition",
      totalProp: "totalPresets",
      hrefPrefix: "/assets/presets/",
    },
    {
      file: "src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx",
      previousProp: "previousGroup",
      nextProp: "nextGroup",
      indexProp: "groupPosition",
      totalProp: "totalGroups",
      hrefPrefix: "/assets/preset-groups/",
    },
  ];

  for (const { file, previousProp, nextProp, indexProp, totalProp, hrefPrefix } of cases) {
    const source = readSource(file);
    const previousHrefConst = `${previousProp}Href`;
    const nextHrefConst = `${nextProp}Href`;
    const positionTextConst = `${indexProp}Text`;
    const previousHrefLine = `const ${previousHrefConst} = ${previousProp}?.id ? \`${hrefPrefix}\${${previousProp}.id}\` : null;`;
    const nextHrefLine = `const ${nextHrefConst} = ${nextProp}?.id ? \`${hrefPrefix}\${${nextProp}.id}\` : null;`;
    const positionTextLine = `const ${positionTextConst} = ${indexProp} >= 0 ? \`\${${indexProp} + 1} / \${${totalProp}}\` : null;`;

    assert.match(
      source,
      /from ["']@\/components\/neighbor-navigation["']/,
      `${file} should import NeighborNavigation`,
    );
    assert.match(
      source,
      /<NeighborNavigation\b/,
      `${file} should render NeighborNavigation`,
    );
    assert.match(
      source,
      new RegExp(escapeRegExp(previousHrefLine)),
      `${file} should build previous href from the previous item id`,
    );
    assert.match(
      source,
      new RegExp(escapeRegExp(nextHrefLine)),
      `${file} should build next href from the next item id`,
    );
    assert.match(
      source,
      new RegExp(escapeRegExp(positionTextLine)),
      `${file} should show one-based position text only for a found current item`,
    );
    assert.match(
      source,
      new RegExp(`<NeighborNavigation[\\s\\S]*previousHref=\\{${previousHrefConst}\\}[\\s\\S]*nextHref=\\{${nextHrefConst}\\}[\\s\\S]*positionText=\\{${positionTextConst}\\}`),
      `${file} should pass hrefs and position text into NeighborNavigation`,
    );
  }
});

test("detail pages remount editors when neighbor links switch route items", () => {
  const cases = [
    {
      file: "src/app/assets/presets/[presetId]/page.tsx",
      component: "PresetEditClient",
      itemId: "preset.id",
    },
    {
      file: "src/app/assets/preset-groups/[groupId]/page.tsx",
      component: "PresetGroupEditClient",
      itemId: "group.id",
    },
  ];

  for (const { file, component, itemId } of cases) {
    const source = readSource(file);

    assert.match(
      source,
      new RegExp(`<${component}[\\s\\S]*key=\\{${escapeRegExp(itemId)}\\}`),
      `${file} should key the editor by item id so client form state does not survive previous/next navigation`,
    );
  }
});
