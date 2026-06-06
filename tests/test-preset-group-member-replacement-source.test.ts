import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function exportedFunctionSource(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} should be exported`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${name} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${name} body should close`);
}

function assertStopsNavigation(source: string, label: string) {
  assert.match(source, /preventDefault\(\)/, `${label} should prevent default link navigation`);
  assert.match(source, /stopPropagation\(\)/, `${label} should stop row/link click propagation`);
}

test("updateGroupMember replaces a preset member and propagates group changes", () => {
  const source = readSource("src/lib/actions/preset-group.ts");
  const body = exportedFunctionSource(source, "updateGroupMember");

  assert.match(source, /import { after as afterResponse } from "next\/server"/, "replacement should use after() for non-blocking downstream sync");
  assert.match(body, /findUnique\([\s\S]*where:\s*{\s*id:\s*memberId\s*}/, "missing members should be checked before update");
  assert.match(body, /presetId:\s*true/, "existing member lookup should select presetId");
  assert.match(body, /subGroupId:\s*true/, "existing member lookup should select subGroupId");
  assert.match(body, /slotCategoryId:\s*true/, "existing member lookup should select slotCategoryId");
  assert.match(body, /if \(!existing\) return null/, "missing members should return null");
  assert.match(body, /!existing\.presetId[\s\S]*existing\.subGroupId[\s\S]*throw new Error\("只能替换普通预制成员"\)/, "sub-group or non-preset members should be rejected");
  assert.match(body, /presetVariant\.findFirst/, "replacement variant should be loaded for validation");
  assert.match(body, /presetId:\s*input\.presetId/, "replacement variant should be scoped to the replacement preset");
  assert.match(body, /isActive:\s*true/, "replacement variant must be active");
  assert.match(body, /include:\s*{\s*preset:\s*{\s*select:\s*{\s*categoryId:\s*true\s*}/, "replacement validation should load the replacement preset category");
  assert.match(body, /!replacementVariant[\s\S]*throw new Error\("替换预制或变体无效"\)/, "invalid replacement preset/variant pairs should be rejected");
  assert.match(body, /existingPreset[\s\S]*preset\.findUnique/, "existing preset category should be loaded for the category lock");
  assert.match(body, /existingPreset\.categoryId !== replacementVariant\.preset\.categoryId/, "replacement should stay in the existing preset category");
  assert.match(body, /existing\.slotCategoryId[\s\S]*existing\.slotCategoryId !== replacementVariant\.preset\.categoryId/, "slot members should also enforce the slot category");
  assert.match(body, /resolveConcreteGroupMembers\(existing\.groupId\)/, "previous concrete members should be captured for sync");
  assert.match(body, /presetId:\s*input\.presetId/, "replacement should update presetId");
  assert.match(body, /variantId:\s*input\.variantId/, "replacement should update variantId");
  assert.match(body, /subGroupId:\s*null/, "replacement should clear subGroupId");
  assert.doesNotMatch(body, /sortOrder:\s*input/, "replacement should preserve existing sortOrder");
  assert.doesNotMatch(body, /slotCategoryId:\s*input/, "replacement should preserve existing slotCategoryId");
  assert.match(body, /dimension:\s*"members"/, "replacement should record members history");
  assert.match(body, /title:\s*"替换预制组成员"/, "replacement history should use the replacement title");
  assert.match(body, /afterResponse\(async \(\) =>[\s\S]*syncPresetGroupInstances\(existing\.groupId,\s*previousMembers\)/, "replacement should sync imported group instances after responding");
  assert.doesNotMatch(body, /^  await syncPresetGroupInstances\(existing\.groupId,\s*previousMembers\)/m, "replacement should not block the UI on imported group instance sync");
  assert.match(body, /revalidatePath\("\/assets\/presets"\)/, "replacement should revalidate presets");
  assert.match(body, /revalidatePath\("\/assets\/preset-groups"\)/, "replacement should revalidate preset groups");
  assert.match(body, /revalidatePath\(`\/assets\/preset-groups\/\$\{existing\.groupId\}`\)/, "replacement should revalidate the changed group detail route");
  assert.match(body, /return updated/, "replacement should return the updated member");
});

test("group detail member rows use a locked preset picker without navigating the row link", () => {
  const source = readSource("src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx");

  assert.match(source, /import { PresetCascadePicker } from "@\/components\/preset-cascade-picker"/, "detail editor should import PresetCascadePicker");
  assert.match(source, /Repeat2/, "detail replacement should use a replacement icon");
  assert.match(source, /\bupdateGroupMember\b/, "detail editor should import and call updateGroupMember");
  assert.match(source, /openReplaceMemberId/, "detail editor should gate the picker behind a replacement button");
  assert.match(source, /aria-label={`替换成员[\s\S]*<Repeat2/, "detail replacement button should be icon-first with Chinese accessible text");
  assert.match(source, /<button[\s\S]*setOpenReplaceMemberId[\s\S]*<\/button>[\s\S]*<PresetCascadePicker/, "detail replacement button should render before the picker");
  assert.match(source, /!member\.subGroupId[\s\S]*openReplaceMemberId === member\.id[\s\S]*<PresetCascadePicker/, "replacement picker should only render for ordinary preset members after opening");
  assert.match(source, /lockedCategoryId={/, "replacement picker should lock to the current member preset category");
  assert.match(source, /await updateGroupMember\(member\.id,[\s\S]*presetId:\s*val\.presetId,[\s\S]*variantId:\s*val\.variantId[\s\S]*\)/, "selection should update the existing member");
  assert.match(source, /toast\.success\("成员已替换"\)/, "selection should toast success");
  assert.match(source, /catch \(error\)[\s\S]*toast\.error\(error instanceof Error \? error\.message : "替换成员失败"\)/, "detail replacement should toast failures");
  assert.match(source, /router\.refresh\(\)/, "selection should refresh the route");
  assertStopsNavigation(source, "detail replacement controls");
});

test("sortable group card inline editor can replace ordinary preset members", () => {
  const source = readSource("src/app/assets/presets/sortable-group-card.tsx");

  assert.match(source, /Repeat2/, "inline replacement should use a replacement icon");
  assert.match(source, /\bupdateGroupMember\b/, "sortable group card should import and call updateGroupMember");
  assert.match(source, /openReplaceMemberId/, "inline editor should gate the picker behind a replacement button");
  assert.match(source, /aria-label={`替换成员[\s\S]*<Repeat2/, "inline replacement button should be icon-first with Chinese accessible text");
  assert.match(source, /<button[\s\S]*setOpenReplaceMemberId[\s\S]*<\/button>[\s\S]*<PresetCascadePicker/, "inline replacement button should render before the picker");
  assert.match(source, /!member\.subGroupId[\s\S]*openReplaceMemberId === member\.id[\s\S]*<PresetCascadePicker/, "inline replacement picker should only render for ordinary preset members after opening");
  assert.match(source, /lockedCategoryId={/, "inline replacement picker should lock to the current member preset category");
  assert.match(source, /await updateGroupMember\(member\.id,[\s\S]*presetId:\s*val\.presetId,[\s\S]*variantId:\s*val\.variantId[\s\S]*\)/, "inline selection should update the existing member");
  assert.match(source, /toast\.success\("成员已替换"\)/, "inline selection should toast success");
  assert.match(source, /onRefresh\(\)/, "inline selection should refresh group data");
  assertStopsNavigation(source, "inline replacement controls");
});
