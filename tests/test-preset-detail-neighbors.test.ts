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

test("group detail page uses lightweight edit data instead of the full preset library", () => {
  const source = readSource("src/app/assets/preset-groups/[groupId]/page.tsx");

  assert.match(
    source,
    /\bgetPresetGroupEditData\b/,
    "group detail navigation should use route-specific edit data",
  );
  assert.doesNotMatch(
    source,
    /\bgetPresetCategoriesWithPresets\b/,
    "group detail navigation should not reload the full preset library on every previous/next switch",
  );
});

test("preset and group detail clients support s/f neighbor shortcuts outside form fields", () => {
  const cases = [
    {
      file: "src/app/assets/presets/[presetId]/preset-edit-client.tsx",
      previousHrefConst: "previousPresetHref",
      nextHrefConst: "nextPresetHref",
    },
    {
      file: "src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx",
      previousHrefConst: "previousGroupHref",
      nextHrefConst: "nextGroupHref",
    },
  ];

  for (const { file, previousHrefConst, nextHrefConst } of cases) {
    const source = readSource(file);

    assert.match(source, /window\.addEventListener\("keydown", handleKeyDown\)/, `${file} should bind a page shortcut handler`);
    assert.match(source, /event\.key\.toLowerCase\(\) === "s"[\s\S]*\? previous\w+Href/, `${file} should map s to the previous item`);
    assert.match(source, /event\.key\.toLowerCase\(\) === "f"[\s\S]*\? next\w+Href/, `${file} should map f to the next item`);
    assert.match(source, new RegExp(`router\\.push\\(href\\)[\\s\\S]*\\}, \\[${nextHrefConst}, ${previousHrefConst}, router\\]\\)`), `${file} should navigate with the current neighbor hrefs`);
    assert.match(source, /target\.isContentEditable[\s\S]*tagName === "INPUT"[\s\S]*tagName === "TEXTAREA"[\s\S]*tagName === "SELECT"/, `${file} should ignore shortcuts while editing form fields`);
  }
});

test("preset and group detail back links restore folder context in the preset library", () => {
  const presetClient = readSource("src/app/assets/presets/[presetId]/preset-edit-client.tsx");
  const groupClient = readSource("src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx");
  const managerSource = readSource("src/app/assets/presets/preset-manager.tsx");
  const groupListSource = readSource("src/app/assets/presets/group-list.tsx");

  assert.match(
    presetClient,
    /if \(preset\.folderId\) \{\s*params\.set\("folder", preset\.folderId\);\s*\}/,
    "preset detail back href should include the preset folder",
  );
  assert.match(
    groupClient,
    /if \(folderId\) \{\s*params\.set\("folder", folderId\);\s*\}/,
    "group detail back href should include the group folder",
  );
  assert.match(
    managerSource,
    /<GroupList[\s\S]*queryFolderId=\{queryFolderId\}[\s\S]*queryGroupId=\{queryPresetId\}[\s\S]*onViewChange=\{\(patch\) => replacePresetQuery\(\{ category: selectedCat\.id, \.\.\.patch \}\)\}/,
    "group list should receive preset-library query state from the URL",
  );
  assert.match(
    groupListSource,
    /queryGroupId:\s*string \| null/,
    "group list should accept the detail-return group id query",
  );
  assert.match(
    groupListSource,
    /const resolvedQueryFolderId = useMemo\([\s\S]*queryGroup[\s\S]*queryGroup\.folderId \?\? null[\s\S]*queryFolderId/,
    "group list should resolve folder from the returned group id before falling back to folder query",
  );
  assert.match(
    groupListSource,
    /setCurrentFolderId\(resolvedQueryFolderId\)/,
    "group list should restore current folder from the resolved query folder",
  );
  assert.match(
    groupListSource,
    /onViewChange\(\{ folder: folderId, preset: null, variant: null \}\)/,
    "group folder navigation should keep the URL query in sync",
  );
});
