import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const showcaseDir = resolve(testDir);
const componentPreviewsSource = readShowcaseSource("pages/component-previews.tsx");
const familySamplesSource = readShowcaseSource("pages/family-samples.tsx");
const previewKeysSource = readShowcaseSource("preview-keys.ts");
const registrySource = readShowcaseSource("registry.ts");
const pendingReviewGroupsCss = readFileSync(resolve(showcaseDir, "../features/runs/pending-review-groups.runs.module.css"), "utf8");
const patternsCss = readFileSync(resolve(showcaseDir, "../shared/patterns/patterns.module.css"), "utf8");
const presetLibraryCss = readFileSync(resolve(showcaseDir, "../features/presets/library-page.library.module.css"), "utf8");
const presetLibrarySource = readFileSync(resolve(showcaseDir, "../features/presets/library-page.tsx"), "utf8");
const presetEditSource = readFileSync(resolve(showcaseDir, "../features/presets/preset-edit-page.tsx"), "utf8");
const presetEditCss = readFileSync(resolve(showcaseDir, "../features/presets/preset-edit-page.library.module.css"), "utf8");
const presetGroupSource = readFileSync(resolve(showcaseDir, "../features/presets/group-page.tsx"), "utf8");
const presetGroupCss = readFileSync(resolve(showcaseDir, "../features/presets/group-page.library.module.css"), "utf8");
const projectIndexSource = readFileSync(resolve(showcaseDir, "../features/projects/index.ts"), "utf8");
const projectListItemCss = readFileSync(resolve(showcaseDir, "../features/projects/project-list-item.projects.module.css"), "utf8");
const projectSectionCardCss = readFileSync(resolve(showcaseDir, "../features/projects/project-section-card.projects.module.css"), "utf8");
const missingSectionSource = readFileSync(resolve(showcaseDir, "../features/projects/editor/missing-section-state.tsx"), "utf8");
const missingSectionCssPath = resolve(showcaseDir, "../features/projects/editor/missing-section-state.editor.module.css");
const missingSectionCss = existsSync(missingSectionCssPath) ? readFileSync(missingSectionCssPath, "utf8") : "";
const modelListSource = readFileSync(resolve(showcaseDir, "../features/models/model-list.tsx"), "utf8");
const modelListCss = readFileSync(resolve(showcaseDir, "../features/models/model-list.module.css"), "utf8");
const runListSource = readFileSync(resolve(showcaseDir, "../features/runs/run-list.tsx"), "utf8");
const runListCss = readFileSync(resolve(showcaseDir, "../features/runs/run-list.runs.module.css"), "utf8");
const reviewMetaCardSource = readFileSync(resolve(showcaseDir, "../features/runs/review-meta-card.tsx"), "utf8");
const reviewMetaCardCss = readFileSync(resolve(showcaseDir, "../features/runs/review-meta-card.runs.module.css"), "utf8");
const reviewPageSource = readFileSync(resolve(showcaseDir, "../features/runs/review-page.tsx"), "utf8");
const templateFormCss = readFileSync(resolve(showcaseDir, "../features/templates/template-form-page.library.module.css"), "utf8");
const templateSectionSource = readFileSync(resolve(showcaseDir, "../features/templates/template-section-page.tsx"), "utf8");
const templateSectionCss = readFileSync(resolve(showcaseDir, "../features/templates/template-section-page.library.module.css"), "utf8");

function readShowcaseSource(relativePath) {
  return readFileSync(resolve(showcaseDir, relativePath), "utf8");
}

function functionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${functionName} body should close`);
}

function jsxTagSource(source, componentName, label) {
  const pattern = new RegExp(`<${componentName}\\b[\\s\\S]*?label="${label}"[\\s\\S]*?\\/>`);
  const match = source.match(pattern);
  assert.ok(match, `${componentName} with label "${label}" should exist`);
  return match[0];
}

function cssBlockSource(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} should exist`);
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${marker} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${marker} body should close`);
}

test("component primitive previews keep local state instead of no-op callbacks", () => {
  assert.match(componentPreviewsSource, /Checkbox:\s*\(\)\s*=>\s*<CheckboxPreview\s*\/>/);
  assert.match(componentPreviewsSource, /Field:\s*\(\)\s*=>\s*<FieldsPreview\s*\/>/);

  const checkboxPreviewSource = functionSource(componentPreviewsSource, "CheckboxPreview");
  assert.match(checkboxPreviewSource, /useState\(true\)/);
  assert.match(checkboxPreviewSource, /useState\(false\)/);
  assert.match(jsxTagSource(checkboxPreviewSource, "Checkbox", "已选择"), /onCheckedChange=\{setCheckedSelected\}/);
  assert.match(jsxTagSource(checkboxPreviewSource, "Checkbox", "未选择"), /onCheckedChange=\{setUncheckedSelected\}/);
  assert.doesNotMatch(checkboxPreviewSource, /onCheckedChange=\{noop\}/);

  const fieldsPreviewSource = functionSource(componentPreviewsSource, "FieldsPreview");
  assert.match(fieldsPreviewSource, /useState\("写实人像"\)/);
  assert.match(fieldsPreviewSource, /useState\("masterpiece, best quality, portrait"\)/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "名称"), /onChange=\{setName\}/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "Prompt"), /multiline/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "Prompt"), /features=\{\{ resize: true, clipboard: true \}\}/);
  assert.match(jsxTagSource(fieldsPreviewSource, "Field", "Prompt"), /onChange=\{setPrompt\}/);

  const specSectionPreviewSource = functionSource(componentPreviewsSource, "SpecSectionPreview");
  assert.match(specSectionPreviewSource, /const\s+\[\s*checkpoint\s*,\s*setCheckpoint\s*\]\s*=\s*useState\("realisticVision\.safetensors"\)/);
  assert.match(jsxTagSource(specSectionPreviewSource, "FloatingSelect", "模型"), /value=\{checkpoint\}/);
  assert.match(jsxTagSource(specSectionPreviewSource, "FloatingSelect", "模型"), /onChange=\{setCheckpoint\}/);
  assert.doesNotMatch(jsxTagSource(specSectionPreviewSource, "FloatingSelect", "模型"), /value="realisticVision\.safetensors"/);
});

test("button primitive preview includes a visible loading state", () => {
  const buttonPreviewSource = functionSource(componentPreviewsSource, "ButtonPreview");

  assert.match(
    buttonPreviewSource,
    /<Button\b(?=[^>]*\bpending\b)(?=[^>]*\btone="primary")[^>]*>\s*处理中\s*<\/Button>/,
  );
});

test("showcase unit row and folder samples expose real visible interactions", () => {
  assert.match(componentPreviewsSource, /UnitRowShell:\s*\(\)\s*=>\s*<UnitRowShellPreview\s*\/>/);
  assert.match(componentPreviewsSource, /FolderBreadcrumb:\s*\(\)\s*=>\s*<FolderBreadcrumbPreview\s*\/>/);
  assert.match(componentPreviewsSource, /MoveTargetPicker:\s*\(\)\s*=>\s*<MoveTargetPickerPreview\s*\/>/);

  const componentUnitSource = functionSource(componentPreviewsSource, "UnitRowShellPreview");
  assert.match(componentUnitSource, /useState\(true\)/);
  assert.match(componentUnitSource, /onCheckedChange=\{setSelected\}/);
  assert.doesNotMatch(componentUnitSource, /onCheckedChange=\{noop\}/);

  const familyUnitSource = functionSource(familySamplesSource, "UnitItemsSample");
  assert.match(familyUnitSource, /const\s+\[\s*selectedProject\s*,\s*setSelectedProject\s*\]\s*=\s*useState\(true\)/);
  assert.match(familyUnitSource, /onCheckedChange=\{setSelectedProject\}/);
  assert.doesNotMatch(familyUnitSource, /onCheckedChange=\{\(\)\s*=>\s*undefined\}/);

  for (const functionName of ["FolderBreadcrumbPreview", "MoveTargetPickerPreview"]) {
    const previewSource = functionSource(componentPreviewsSource, functionName);
    assert.match(previewSource, /useState(?:<[^>]+>)?\(/, `${functionName} should keep local state`);
    assert.doesNotMatch(previewSource, /on(?:Navigate|Move)=\{noop\}/, `${functionName} should not wire primitive clicks to noop`);
  }

  const foldersSampleSource = functionSource(familySamplesSource, "FoldersSample");
  assert.match(foldersSampleSource, /useState(?:<[^>]+>)?\("realistic"\)/);
  assert.match(foldersSampleSource, /onNavigate=\{setActiveFolderId\}/);
  assert.match(foldersSampleSource, /onMove=\{setMoveTargetId\}/);
  assert.doesNotMatch(foldersSampleSource, /on(?:Navigate|Move)=\{\(\)\s*=>\s*undefined\}/);
});

test("unit-items adapter previews do not leave row checkboxes wired to noop", () => {
  assert.match(componentPreviewsSource, /ProjectListItem:\s*\(\{ data \}\)\s*=>\s*<ProjectListItemPreview data=\{data\}\s*\/>/);
  assert.match(componentPreviewsSource, /PresetLibraryItemRow:\s*\(\{ data \}\)\s*=>\s*<PresetLibraryItemRowPreview data=\{data\}\s*\/>/);

  const projectPreviewSource = functionSource(componentPreviewsSource, "ProjectListItemPreview");
  assert.match(projectPreviewSource, /useState\(true\)/);
  assert.match(projectPreviewSource, /selected=\{selected\}/);
  assert.match(projectPreviewSource, /onToggleSelected=\{\(\)\s*=>\s*setSelected\(\(current\)\s*=>\s*!current\)\}/);
  assert.doesNotMatch(projectPreviewSource, /onToggleSelected=\{noop\}/);

  const presetPreviewSource = functionSource(componentPreviewsSource, "PresetLibraryItemRowPreview");
  assert.match(presetPreviewSource, /useState\(true\)/);
  assert.match(presetPreviewSource, /checked=\{checked\}/);
  assert.match(presetPreviewSource, /onToggle=\{\(\)\s*=>\s*setChecked\(\(current\)\s*=>\s*!current\)\}/);
  assert.doesNotMatch(presetPreviewSource, /onToggle=\{noop\}/);
});

test("preset library item row uses the shared unit row shell surface", () => {
  const presetItemRowBlock = cssBlockSource(presetLibraryCss, ".presetItemRow {");

  assert.match(presetLibrarySource, /export function PresetLibraryItemRow\([\s\S]*?<UnitRowShell\b/, "PresetLibraryItemRow should use UnitRowShell instead of a one-off row shell");
  assert.match(presetLibrarySource, /export function PresetLibraryItemRow\([\s\S]*?selected=\{checked\}/, "PresetLibraryItemRow should delegate selected surface styling to UnitRowShell");
  assert.match(presetLibrarySource, /export function PresetLibraryItemRow\([\s\S]*?leading=\{\([\s\S]*?<Checkbox\b/, "PresetLibraryItemRow should keep the checkbox in the UnitRowShell leading slot");
  assert.doesNotMatch(presetItemRowBlock, /border:\s*1px\s+solid\s+transparent/, "PresetLibraryItemRow should not hide the UnitRowShell border");
  assert.doesNotMatch(presetItemRowBlock, /border-bottom-color/, "PresetLibraryItemRow should not reduce the row shell to a bottom divider");
});

test("project list item preview shows default and compact states", () => {
  const projectPreviewSource = functionSource(componentPreviewsSource, "ProjectListItemPreview");
  const projectListItems = projectPreviewSource.match(/<ProjectListItem\b/g) ?? [];

  assert.equal(projectListItems.length, 2, "ProjectListItem showcase preview should include both default and compact states");
  assert.match(projectPreviewSource, /<ProjectListItem\s+compact\b/, "ProjectListItem showcase preview should include the compact folded state");
});

test("project section card preview shows collapsed and expanded states", () => {
  assert.match(
    componentPreviewsSource,
    /ProjectSectionCard:\s*\(\{ data \}\)\s*=>\s*\{[\s\S]*?<ProjectSectionCard\s+compact\s+index=\{0\}\s+project=\{project\}\s+section=\{section\}\s*\/>[\s\S]*?<ProjectSectionCard\s+compact=\{false\}\s+index=\{1\}\s+project=\{project\}\s+section=\{expandedSection\}\s*\/>/,
    "ProjectSectionCard showcase preview should include both collapsed and expanded states",
  );
});

test("project section card expanded image list spans the full row", () => {
  const sectionRecentResultBlock = cssBlockSource(projectSectionCardCss, ".sectionRecentResult");
  const sectionRecentResultImagesBlock = cssBlockSource(projectSectionCardCss, ".sectionRecentResult .recentResultImages");

  assert.match(sectionRecentResultBlock, /width:\s*100%/, "ProjectSectionCard image-list link should span the full content row");
  assert.match(
    sectionRecentResultImagesBlock,
    /width:\s*100%/,
    "ProjectSectionCard image list should use the full link width instead of a capped preview width",
  );
  assert.doesNotMatch(sectionRecentResultImagesBlock, /width:\s*min\(270px,\s*100%\)/, "ProjectSectionCard image list should not be capped at 270px");
});

test("unit row shell has responsive slot layout and bright hover feedback", () => {
  assert.match(
    patternsCss,
    /\.unitRow:hover\s*\{[\s\S]*?background:\s*var\(--demo-glass-hover\)/,
    "UnitRowShell hover should visibly brighten instead of staying on the base surface",
  );
  assert.match(
    patternsCss,
    /\.unitRowSelected:hover\s*\{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--demo-green\)/,
    "selected UnitRowShell hover should preserve the green selected state instead of falling back to gray hover",
  );
  assert.match(
    patternsCss,
    /@media\s*\(max-width:\s*639px\)[\s\S]*?\.unitRow\s*\{[\s\S]*?grid-template-areas:/,
    "UnitRowShell should define mobile grid areas instead of keeping desktop columns",
  );
  for (const area of ["drag", "leading", "media", "main", "meta", "actions"]) {
    assert.match(
      patternsCss,
      new RegExp(`grid-area:\\s*${area}`),
      `UnitRowShell ${area} slot should have a named grid area for mobile placement`,
    );
  }
  assert.match(
    patternsCss,
    /@media\s*\(max-width:\s*639px\)[\s\S]*?\.unitActions\s*\{[\s\S]*?width:\s*100%/,
    "UnitRowShell actions should span the row on narrow screens",
  );
});

test("checkable unit item wrappers do not keep hover background through focus-within", () => {
  for (const [componentName, css, selector] of [
    ["ProjectListItem", projectListItemCss, "projectListCard"],
    ["PresetLibraryItemRow", presetLibraryCss, "presetItemRow"],
    ["ProjectSectionCard", projectSectionCardCss, "sectionCard"],
    ["TemplateSectionRow", templateFormCss, "templateSectionRow"],
  ]) {
    assert.doesNotMatch(
      css,
      new RegExp(`\\.${selector}[^,{]*:focus-within\\s*\\{[^}]*background:\\s*var\\(--demo-(?:field-bg|glass-hover)\\)`),
      `${componentName} should not keep the hover background while a child control retains focus`,
    );
  }
});

test("section and template rows separate resting and hover surfaces", () => {
  assert.match(
    projectSectionCardCss,
    /\.sectionCard:hover\s*\{[^}]*background:\s*var\(--demo-glass-hover\)/,
    "ProjectSectionCard hover should visibly brighten the card surface",
  );
  assert.doesNotMatch(
    templateFormCss,
    /\.templateSectionRow\s*\{[^}]*background:\s*var\(--demo-field-bg\)/,
    "TemplateSectionRow should not use the bright field background as its resting surface",
  );
  assert.match(
    templateFormCss,
    /\.templateSectionRow:hover\s*\{[^}]*background:\s*var\(--demo-glass-hover\)/,
    "TemplateSectionRow hover should provide the bright gray feedback instead",
  );
});

test("unit item titles do not turn green on hover", () => {
  for (const [componentName, css, pattern] of [
    ["ProjectListItem", projectListItemCss, /\.projectListTitleLink:hover\s+strong[\s\S]*?\{[^}]*color:\s*var\(--demo-green\)/],
    ["PresetLibraryItemRow", presetLibraryCss, /\.(?:presetItemOpenArea|presetItemTitleLink):hover[\s\S]*?\{[^}]*color:\s*var\(--demo-green\)/],
    ["ProjectSectionCard", projectSectionCardCss, /\.sectionCardTitleLink:hover\s+strong[\s\S]*?\{[^}]*color:\s*var\(--demo-green\)/],
    ["TemplateSectionRow", templateFormCss, /\.templateSectionRowMain:hover(?:\s+\.templateSectionTitleLine\s*>\s*strong[\s\S]*?\{[^}]*color:\s*var\(--demo-green\)|\s*,[\s\S]*?\{[^}]*color:\s*var\(--demo-green\)|\s*\{[^}]*color:\s*var\(--demo-green\))/],
  ]) {
    assert.doesNotMatch(
      css,
      pattern,
      `${componentName} title should not turn green on hover`,
    );
  }
});

test("preset and template rows reserve stacked layout for truly narrow screens", () => {
  const presetTabletCss = cssBlockSource(presetLibraryCss, "@media (min-width: 640px) and (max-width: 1023px)");
  const templateTabletCss = cssBlockSource(templateFormCss, "@media (min-width: 640px) and (max-width: 1023px)");
  const templateMobileCss = cssBlockSource(templateFormCss, "@media (max-width: 639px)");

  assert.doesNotMatch(
    presetTabletCss,
    /\.presetItemOpenArea\s*\{[\s\S]*?grid-template-columns:\s*12px\s+minmax\(0,\s*1fr\)\s+18px/,
    "PresetLibraryItemRow should not stack metadata in tablet-width showcase previews",
  );
  assert.doesNotMatch(
    templateTabletCss,
    /\.templateSectionRowActions\s*\{[\s\S]*?grid-column:\s*2/,
    "TemplateSectionRow should not force actions below the content in tablet-width showcase previews",
  );
  assert.match(
    templateMobileCss,
    /\.templateSectionRow\s*\{[\s\S]*?grid-template-columns:\s*22px\s+minmax\(0,\s*1fr\)/,
    "TemplateSectionRow should keep its drag handle beside the content on narrow screens",
  );
});

test("preset category sidebar fills the route-header viewport remainder", () => {
  const layoutBlock = cssBlockSource(presetLibraryCss, ".presetManagerLayout");
  const sidebarBlock = cssBlockSource(presetLibraryCss, ".presetCategorySidebar {");
  const mobileBlock = cssBlockSource(presetLibraryCss, "@media (max-width: 639px)");

  assert.match(
    layoutBlock,
    /--preset-sidebar-height:\s*calc\(100dvh\s*-\s*var\(--demo-route-header-height/,
    "Preset manager layout should derive sidebar height from the route header viewport remainder",
  );
  assert.match(sidebarBlock, /height:\s*var\(--preset-sidebar-height\)/, "Preset sidebar should fill the computed remaining height");
  assert.match(sidebarBlock, /max-height:\s*var\(--preset-sidebar-height\)/, "Preset sidebar scroll area should match the filled height");
  assert.doesNotMatch(sidebarBlock, /max-height:\s*calc\(100vh\s*-\s*180px\)/, "Preset sidebar should not use the old undersized fixed viewport subtraction");
  assert.match(mobileBlock, /\.presetCategorySidebar\s*\{[\s\S]*?height:\s*auto/, "Mobile preset sidebar should return to natural height");
});

test("preset library page avoids duplicate category management controls", () => {
  const sidebarSource = functionSource(presetLibrarySource, "PresetCategorySidebar");

  assert.doesNotMatch(presetLibrarySource, /<OperationStateStrip\b/, "Preset library page should not show the redundant sorting state strip");
  assert.doesNotMatch(sidebarSource, /href="\/presets\/categories\/new"/, "Preset category sidebar should not duplicate the route-header new-category action");
  assert.doesNotMatch(sidebarSource, /ariaLabel="新建分类"/, "Preset category sidebar should not expose a duplicate new-category button");
});

test("editor pages do not render duplicate sticky editor headers", () => {
  for (const [name, source, css] of [
    ["PresetEditPage", presetEditSource, presetEditCss],
    ["PresetGroupPage", presetGroupSource, presetGroupCss],
    ["TemplateSectionPage", templateSectionSource, templateSectionCss],
  ]) {
    assert.doesNotMatch(source, /className=\{s\.editorStickyHeader\}/, `${name} should not render a duplicate sticky editor header`);
    assert.doesNotMatch(css, /\.editorStickyHeader\b/, `${name} stylesheet should not keep unused sticky-header styles`);
    assert.doesNotMatch(css, /\.editorIdentity\b/, `${name} stylesheet should not keep unused editor identity styles`);
  }

});

test("route-header pages do not keep hand-written legacy page headers", () => {
  assert.doesNotMatch(modelListSource, /<header className=\{styles\.pageHeader\}>/, "Models page should rely on the route header instead of a visible local page header");
  assert.doesNotMatch(modelListCss, /\.pageHeader\b/, "Models stylesheet should not keep old local page-header styles");
  assert.doesNotMatch(missingSectionSource, /className=\{s\.pageHeader\}/, "Missing section state should not render a second local page header");
  assert.doesNotMatch(missingSectionCss, /\.pageHeader\b/, "Missing section state should not keep old local page-header styles");
  assert.doesNotMatch(projectIndexSource, /ProjectDetailHeader/, "Projects barrel should not expose the unused legacy project detail header");
  assert.equal(existsSync(resolve(showcaseDir, "../features/projects/project-detail-header.tsx")), false, "Unused project detail header implementation should be removed");
  assert.equal(existsSync(resolve(showcaseDir, "../features/projects/project-detail-header.projects.module.css")), false, "Unused project detail header stylesheet should be removed");
});

test("showcase pages do not wire visible controls to no-op callbacks", () => {
  assert.doesNotMatch(componentPreviewsSource, /\bnoop\b/);
  assert.doesNotMatch(componentPreviewsSource, /=>\s*undefined/);
  assert.doesNotMatch(familySamplesSource, /=>\s*undefined/);
});

test("preset sync showcase entries document durable non-noop interactions", () => {
  for (const componentName of [
    "PresetCopySyncPreview",
    "AutoSaveQueuePreview",
    "CivitaiLinkManagerPreview",
    "ApplyToAllVariantsPreview",
  ]) {
    assert.match(previewKeysSource, new RegExp(`"${componentName}"`), `${componentName} must have a preview key`);
    assert.match(componentPreviewsSource, new RegExp(`${componentName}:\\s*\\(\\)\\s*=>\\s*<${componentName}\\s*\\/>`), `${componentName} must render a dedicated preview`);
    assert.match(registrySource, new RegExp(`componentName:\\s*"${componentName}"`), `${componentName} must be listed in the registry`);
  }

  for (const reviewName of ["预设复制", "自动保存队列", "Civitai 链接", "应用到所有变体"]) {
    assert.match(registrySource, new RegExp(`reviewName:\\s*"${reviewName}"`), `${reviewName} should be visible with a Chinese review name`);
  }

  const presetCopySource = functionSource(componentPreviewsSource, "PresetCopySyncPreview");
  assert.match(presetCopySource, /useState\(\["写实人像",\s*"胶片风格"\]\)/);
  assert.match(presetCopySource, /function\s+handlePresetCopy\(/);
  assert.match(presetCopySource, /setCopiedPresets\(\(current\)\s*=>\s*\[/);
  assert.match(presetCopySource, /setCopyStatus\("已复制"\)/);
  assert.doesNotMatch(presetCopySource, /feedback=\{\{/);

  const autoSaveSource = functionSource(componentPreviewsSource, "AutoSaveQueuePreview");
  assert.match(autoSaveSource, /useState\(\[\s*\{\s*id:\s*"prompt"/);
  assert.match(autoSaveSource, /function\s+retryFailedSave\(/);
  assert.match(autoSaveSource, /setSaveQueue\(\(current\)\s*=>\s*current\.map/);
  assert.match(autoSaveSource, /status:\s*"saving"/);
  assert.doesNotMatch(autoSaveSource, /feedback=\{\{/);

  const civitaiSource = functionSource(componentPreviewsSource, "CivitaiLinkManagerPreview");
  assert.match(civitaiSource, /useState\("https:\/\/civitai\.com\/models\/2491032"\)/);
  assert.match(civitaiSource, /function\s+updateCivitaiLink\(/);
  assert.match(civitaiSource, /setCivitaiLink\(nextLink\)/);
  assert.match(civitaiSource, /setLinkState\(/);
  assert.doesNotMatch(civitaiSource, /feedback=\{\{/);

  const applySource = functionSource(componentPreviewsSource, "ApplyToAllVariantsPreview");
  assert.match(applySource, /useState\(\[/);
  assert.match(applySource, /function\s+applyPromptToAllVariants\(/);
  assert.match(applySource, /setVariants\(\(current\)\s*=>\s*current\.map/);
  assert.match(applySource, /prompt:\s*sourcePrompt/);
  assert.doesNotMatch(applySource, /feedback=\{\{/);
});

test("preset sync family sample exposes the same real state transitions", () => {
  const sampleSource = functionSource(familySamplesSource, "PresetPromptLoraSample");

  for (const identifier of [
    "handlePresetCopy",
    "retryFailedSave",
    "updateCivitaiLink",
    "applyPromptToAllVariants",
  ]) {
    assert.match(sampleSource, new RegExp(`function\\s+${identifier}\\(`), `PresetPromptLoraSample should include ${identifier}`);
  }

  assert.match(sampleSource, /setCopiedPresets\(\(current\)\s*=>\s*\[/);
  assert.match(sampleSource, /setSaveQueue\(\(current\)\s*=>\s*current\.map/);
  assert.match(sampleSource, /setCivitaiLink\(nextLink\)/);
  assert.match(sampleSource, /setVariants\(\(current\)\s*=>\s*current\.map/);
});

test("queue image list stats stay above thumbnails on narrow layouts", () => {
  assert.doesNotMatch(
    pendingReviewGroupsCss,
    /@media\s*\(max-width:\s*639px\)[\s\S]*?\.queueThumbs\s*\{[^}]*display:\s*flex/,
    "mobile queue thumbnails must not turn the ImageListSmall frame into a horizontal flex row",
  );
  assert.doesNotMatch(
    pendingReviewGroupsCss,
    /\.queueThumbs\s+span\s*,/,
    "queue thumbnail overrides must not give ImageListStats text spans thumbnail widths",
  );
});

test("failed run rows show a compact error card with footer actions", () => {
  assert.match(
    runListSource,
    /className=\{s\.queueRunSecondary\}/,
    "failed run rows should render a dedicated secondary row for failure details and actions",
  );
  assert.doesNotMatch(runListSource, /<details\b/, "failed run reason should not use a disclosure here");
  assert.doesNotMatch(runListSource, /<summary\b/, "failed run reason should not render a folded summary here");
  assert.match(
    runListSource,
    /className=\{s\.queueRunErrorHeader\}[\s\S]*?失败原因/,
    "failed run card should show a full reason header above the actions",
  );
  assert.match(
    runListSource,
    /const\s+ERROR_CLAMP_LINES\s*=\s*3/,
    "failed run error text should have an explicit compact clamp budget",
  );
  assert.match(
    runListSource,
    /className=\{cx\(s\.queueRunErrorText,\s*!expanded && s\.queueRunErrorTextClamped\)\}[\s\S]*?--error-clamp-lines[\s\S]*?ERROR_CLAMP_LINES[\s\S]*?\{errorMessage\}/,
    "failed run card should clamp long error text before the action row",
  );
  assert.match(
    runListSource,
    /overflows && !expanded[\s\S]*?展开[\s\S]*?expanded[\s\S]*?收起/,
    "failed run card should provide explicit expand and collapse controls for long errors",
  );
  assert.match(
    runListCss,
    /\.queueRunErrorTextClamped\s*\{[\s\S]*?-webkit-line-clamp:\s*var\(--error-clamp-lines,\s*3\)/,
    "failed run card should clamp long error text through the compact error style",
  );
  assert.match(
    runListSource,
    /className=\{cx\(s\.toolbar,\s*s\.queueRunFailureToolbar\)\}[\s\S]*?className=\{s\.queueRunErrorCopy\}[\s\S]*?className=\{s\.queueRunRetryAction\}/,
    "failed run card should put copy and retry together in the footer action row",
  );
  assert.match(
    runListCss,
    /\.queueRunRowFailed\s*\{[\s\S]*?grid-template-areas:\s*[\s\S]*?secondary/,
    "failed run grid should reserve a secondary row for reason and retry controls",
  );
  assert.match(
    runListCss,
    /\.queueRunSecondary\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    "failed run error card should use a single-column modal-like layout",
  );
  assert.match(
    runListCss,
    /\.queueRunSecondary\s*\{[\s\S]*?background:\s*color-mix/,
    "failed run secondary row should read as one error card instead of floating controls",
  );
  assert.match(
    runListCss,
    /\.queueRunFailureToolbar\s*\{[\s\S]*?border-top:\s*1px solid/,
    "failed run card actions should sit in a separated footer row",
  );
  assert.match(
    runListCss,
    /\.queueRunRetryAction\.queueRunRetryAction\s*\{[\s\S]*?--button-color:\s*var\(--demo-red\)/,
    "retry inside the red failure card should avoid the green primary treatment",
  );
  assert.match(
    runListCss,
    /@media\s*\(max-width:\s*439px\)[\s\S]*?\.queueRunSecondary\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    "failed run secondary row should collapse before controls are clipped on very narrow screens",
  );
  assert.doesNotMatch(
    runListCss,
    /\.queueRunRowSelectable\s+\.toolbar\s*\{/,
    "mobile toolbar placement must not target nested failure toolbars by accident",
  );
});

test("run review collapsed meta header stays minimal and aligned", () => {
  assert.match(
    reviewMetaCardSource,
    /const\s+completedAt\s*=\s*run\.finishedAt\s*\?\?\s*run\.createdAt/,
    "collapsed run meta should derive a single completion time",
  );
  assert.match(
    reviewMetaCardSource,
    /<span>完成于 \{completedAt\}<\/span>/,
    "collapsed run meta should show only completion time text",
  );
  assert.doesNotMatch(reviewMetaCardSource, /<strong>参数信息<\/strong>/, "collapsed run meta should not label the row as parameter info");
  assert.doesNotMatch(reviewMetaCardSource, /const\s+summary\s*=/, "collapsed run meta should not build a multi-field summary");
  assert.doesNotMatch(reviewMetaCardSource, /reviewMetaSummary/, "collapsed run meta should not render a summary list");
  assert.match(
    reviewMetaCardCss,
    /\.reviewMetaHeading\s*\{[\s\S]*?align-items:\s*center/,
    "collapsed run meta text should stay vertically centered",
  );
  assert.match(
    reviewMetaCardCss,
    /\.reviewMetaHeader\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/,
    "review meta header should reserve a rightmost column for the chevron",
  );
});

test("run review filter tabs are not wrapped in a nested card panel", () => {
  assert.match(
    reviewPageSource,
    /className=\{s\.reviewFilterTabs\}/,
    "review page tabs should use the page-level tablist styling used inside a surface",
  );
  assert.doesNotMatch(
    reviewPageSource,
    /<SegmentedControl[\s\S]{0,600}\bpanel\b/,
    "review page tabs should not add a SegmentedControl panel inside reviewSurface",
  );
});
