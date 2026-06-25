import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function assertFileExists(path: string) {
  assert.equal(existsSync(resolve(process.cwd(), path)), true, `${path} should exist`);
}

test("batch preset replacement uses the preset cascade picker for source and target presets", () => {
  const source = readSource("src/components/preset-section-replacement-dialog.tsx");

  assert.match(source, /import \{ PresetCascadePicker \} from "@\/components\/preset-cascade-picker"/);
  assert.match(source, /<PresetCascadePicker[\s\S]*fromPresetId/);
  assert.match(source, /<PresetCascadePicker[\s\S]*toPresetId/);
  assert.match(source, /lockedCategoryId=\{fromPreset\?\.categoryId/);
  assert.doesNotMatch(source, /<select[\s\S]*value=\{rule\.fromPresetId\}/);
  assert.doesNotMatch(source, /<select[\s\S]*value=\{rule\.toPresetId\}/);
});

test("project create and edit forms use preset cascade pickers backed by preset folders", () => {
  const formOptions = readSource("src/server/repositories/project-view-repository/form-view.ts");
  const createForm = readSource("src/app/projects/new/project-form.tsx");
  const editForm = readSource("src/app/projects/[projectId]/edit/project-edit-form.tsx");

  assert.match(formOptions, /folders:\s*Array<\{[\s\S]*parentId:\s*string \| null[\s\S]*sortOrder:\s*number/);
  assert.match(formOptions, /folderId:\s*string \| null/);
  assert.match(formOptions, /folders:\s*\{[\s\S]*orderBy:\s*\[\{ parentId: "asc" \}/);
  assert.match(formOptions, /folderId:\s*p\.folderId/);

  for (const [label, source] of [["create", createForm], ["edit", editForm]] as const) {
    assert.match(source, /import \{ PresetCascadePicker \} from "@\/components\/preset-cascade-picker"/, `${label} form should import PresetCascadePicker`);
    assert.match(source, /<PresetCascadePicker[\s\S]*lockedCategoryId=\{cat\.id\}/, `${label} form should lock each picker to its category`);
    assert.match(source, /presetCategoriesOnly/, `${label} form should keep generation preset category filtering`);
    assert.doesNotMatch(source, /<select[\s\S]*cat\.presets\.map/, `${label} form should not render category presets as a flat select`);
    assert.doesNotMatch(source, /selectedPreset\.variants\.length > 1[\s\S]*<select/, `${label} form should not keep a separate variant select`);
  }
});

test("sync preset variant flow picks reference projects through a folder-aware project picker", () => {
  assertFileExists("src/components/project-cascade-picker.tsx");
  const picker = readSource("src/components/project-cascade-picker.tsx");
  const dialog = readSource("src/app/projects/[projectId]/sync-preset-variant-flow-dialog.tsx");

  assert.match(picker, /export function ProjectCascadePicker/);
  assert.match(picker, /Folder/);
  assert.match(picker, /folderId/);
  assert.match(picker, /import \{ createPortal \} from "react-dom"/);
  assert.match(picker, /createPortal\(/);
  assert.match(picker, /document\.body/);
  assert.match(dialog, /import \{ ProjectCascadePicker \} from "@\/components\/project-cascade-picker"/);
  assert.match(dialog, /fetch\("\/api\/project-folders"\)/);
  assert.match(dialog, /<ProjectCascadePicker/);
  assert.doesNotMatch(dialog, /<select[\s\S]*projects\.map/);
});

test("preset subgroup selection uses a folder-aware preset group cascade picker", () => {
  assertFileExists("src/components/preset-group-cascade-picker.tsx");
  const picker = readSource("src/components/preset-group-cascade-picker.tsx");
  const addMemberForm = readSource("src/app/assets/presets/add-group-member-form.tsx");
  const createForm = readSource("src/app/assets/presets/group-create-form.tsx");

  assert.match(picker, /export function PresetGroupCascadePicker/);
  assert.match(picker, /groups/);
  assert.match(picker, /folderId/);

  for (const [label, source] of [["add member", addMemberForm], ["create group", createForm]] as const) {
    assert.match(source, /import \{ PresetGroupCascadePicker \} from "@\/components\/preset-group-cascade-picker"/, `${label} form should import PresetGroupCascadePicker`);
    assert.match(source, /<PresetGroupCascadePicker/);
    assert.doesNotMatch(source, /<select value=\{selGroupId\}/, `${label} form should not keep a flat subgroup select`);
  }
});
