# Bulk Preset Section Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a current-project/current-template bulk imported-preset replacement workflow, and make LoRA local edits detach from preset bindings consistently.

**Architecture:** Keep the mutation rules server-side in a shared replacement service that supports `project` and `template` targets. Use small client helpers and one reusable dialog for the two toolbar entry points. Keep LoRA detach persistence in the existing normalized write paths so resolved configs and replacement plans agree.

**Tech Stack:** Next.js 16 App Router route handlers, React client components, Prisma, Node `node:test`, `tsx`, existing `ok`/`fail` API response helpers.

---

### Task 1: LoRA Detach Persistence

**Files:**
- Modify: `src/lib/lora-types.ts`
- Modify: `src/app/projects/[projectId]/sections/[sectionId]/page.tsx`
- Modify: `src/server/prompt-config/template-resolver.ts`
- Test: `tests/test-lora-detach-persistence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/test-lora-detach-persistence.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { shouldPersistLoraBindingLink } from "../src/lib/lora-types";

test("detached preset LoRA persists as manual without binding link", () => {
  assert.equal(shouldPersistLoraBindingLink({
    source: "manual",
    detachedBindingId: "bind-a",
    detachedPresetPath: "a.safetensors",
  }), false);
});

test("suppressed preset LoRA persists as detached manual tombstone without binding link", () => {
  assert.equal(shouldPersistLoraBindingLink({
    source: "manual",
    detachedBindingId: "bind-a",
    detachedPresetPath: "a.safetensors",
    suppressed: true,
  }), false);
});

test("ordinary manual LoRA does not attach to preset binding", () => {
  assert.equal(shouldPersistLoraBindingLink({ source: "manual" }), false);
});

test("clean preset LoRA can keep binding identity until the caller filters it out", () => {
  assert.equal(shouldPersistLoraBindingLink({ source: "preset", bindingId: "bind-a" }), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test tests/test-lora-detach-persistence.test.ts
```

Expected: FAIL because `shouldPersistLoraBindingLink` is not exported.

- [ ] **Step 3: Implement the helper**

Add this helper to `src/lib/lora-types.ts` near the suppression helpers:

```ts
export function shouldPersistLoraBindingLink(
  entry: Pick<LoraEntry, "source" | "bindingId" | "detachedBindingId" | "detachedPresetPath" | "suppressed">,
) {
  return (
    entry.source === "preset" &&
    Boolean(entry.bindingId) &&
    !entry.detachedBindingId &&
    !entry.detachedPresetPath &&
    entry.suppressed !== true
  );
}
```

- [ ] **Step 4: Use the helper in project LoRA persistence**

In `src/app/projects/[projectId]/sections/[sectionId]/page.tsx`, import `shouldPersistLoraBindingLink` from `@/lib/lora-types`.

Inside `handleLoraChange`, change manual row creation so detached entries keep metadata but do not write `sectionBindingId`:

```ts
const bindingKey = entry.detachedBindingId ?? entry.bindingId ?? null;
const binding = bindingKey ? bindingByKey.get(bindingKey) ?? null : null;
const shouldLinkBinding = shouldPersistLoraBindingLink(entry);
return [{
  projectSectionId: sectionId,
  sectionBindingId: shouldLinkBinding ? binding?.id ?? null : null,
  stage,
  path: entry.path,
  weight: Math.round(entry.weight * 100) / 100,
  enabled: entry.suppressed === true ? false : entry.enabled,
  detachedFromBindingKey: entry.detachedBindingId ?? (entry.source === "preset" ? entry.bindingId ?? null : null),
  detachedFromPresetId: binding?.presetId ?? null,
  detachedFromVariantId: binding?.variantId ?? null,
  detachedFromPath: entry.detachedPresetPath ?? (entry.source === "preset" ? entry.path : null),
  metadata: entry.suppressed === true ? { suppressed: true } : undefined,
  sortOrder: index,
}];
```

- [ ] **Step 5: Use the helper in template section persistence**

In `src/server/prompt-config/template-resolver.ts`, import `shouldPersistLoraBindingLink` from `@/lib/lora-types`.

Inside `buildTemplateSectionRowsFromSectionData`, change manual LoRA row creation so detached entries keep metadata but do not write `templateSectionBindingId`:

```ts
const shouldLinkBinding = shouldPersistLoraBindingLink(entry as Parameters<typeof shouldPersistLoraBindingLink>[0]);
templateSectionBindingId: shouldLinkBinding ? binding?.id ?? null : null,
```

Keep `detachedFromPresetId` and `detachedFromVariantId` derived from the original binding when `binding` exists.

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
npx tsx --test tests/test-lora-detach-persistence.test.ts
```

Expected: PASS.

### Task 2: Replacement Core, Service, And API

**Files:**
- Create: `src/server/services/preset-section-replacement-core.ts`
- Create: `src/server/services/preset-section-replacement-service.ts`
- Create: `src/app/api/projects/[projectId]/preset-replacements/route.ts`
- Create: `src/app/api/templates/[templateId]/preset-replacements/route.ts`
- Test: `tests/test-preset-section-replacement-core.test.ts`

- [ ] **Step 1: Write the failing core tests**

Create `tests/test-preset-section-replacement-core.test.ts` with tests that call `planPresetSectionReplacements`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { planPresetSectionReplacements } from "../src/server/services/preset-section-replacement-core";

const presets = [
  { id: "a", name: "A", categoryId: "cat-1", isActive: true, variants: [{ id: "a-v1", name: "A1", isActive: true, sortOrder: 0 }] },
  { id: "b", name: "B", categoryId: "cat-1", isActive: true, variants: [{ id: "b-v1", name: "B1", isActive: true, sortOrder: 0 }, { id: "b-v2", name: "B2", isActive: true, sortOrder: 1 }] },
  { id: "c", name: "C", categoryId: "cat-2", isActive: true, variants: [{ id: "c-v1", name: "C1", isActive: true, sortOrder: 0 }] },
  { id: "no-variant", name: "No Variant", categoryId: "cat-1", isActive: true, variants: [] },
];

const bindings = [
  { id: "bind-row-1", ownerId: "s1", ownerName: "小节 1", ownerSortOrder: 0, bindingKey: "bind-1", categoryId: "cat-1", presetId: "a", variantId: "a-v1", presetGroupId: null, groupBindingKey: null, sortOrder: 0 },
  { id: "bind-row-2", ownerId: "s2", ownerName: "小节 2", ownerSortOrder: 1, bindingKey: "bind-2", categoryId: "cat-1", presetId: "b", variantId: "b-v1", presetGroupId: null, groupBindingKey: null, sortOrder: 1 },
  { id: "group-row", ownerId: "s3", ownerName: "小节 3", ownerSortOrder: 2, bindingKey: "group-bind", categoryId: "cat-1", presetId: null, variantId: null, presetGroupId: "group-1", groupBindingKey: "group-key", sortOrder: 2 },
];

test("plans ordinary same-category preset replacement with default target variant", () => {
  const result = planPresetSectionReplacements({ presets, bindings, rules: [{ fromPresetId: "a", toPresetId: "b" }] });
  assert.equal(result.hasBlockers, false);
  assert.equal(result.totalPlannedUpdateCount, 1);
  assert.deepEqual(result.rules[0].updates.map((item) => ({ bindingRowId: item.bindingRowId, toVariantId: item.toVariantId })), [
    { bindingRowId: "bind-row-1", toVariantId: "b-v1" },
  ]);
});

test("honors explicit target variant", () => {
  const result = planPresetSectionReplacements({ presets, bindings, rules: [{ fromPresetId: "a", toPresetId: "b", toVariantId: "b-v2" }] });
  assert.equal(result.rules[0].updates[0].toVariantId, "b-v2");
});

test("reports no-op source matches without blocking", () => {
  const result = planPresetSectionReplacements({ presets, bindings, rules: [{ fromPresetId: "c", toPresetId: "c" }] });
  assert.equal(result.hasBlockers, false);
  assert.equal(result.totalPlannedUpdateCount, 0);
  assert.equal(result.rules[0].status, "noop");
});

test("blocks cross-category replacements", () => {
  const result = planPresetSectionReplacements({ presets, bindings, rules: [{ fromPresetId: "a", toPresetId: "c" }] });
  assert.equal(result.hasBlockers, true);
  assert.match(result.rules[0].blockers[0].message, /同分类/);
});

test("blocks target preset without active variants", () => {
  const result = planPresetSectionReplacements({ presets, bindings, rules: [{ fromPresetId: "a", toPresetId: "no-variant" }] });
  assert.equal(result.hasBlockers, true);
  assert.match(result.rules[0].blockers[0].message, /active variant|可用变体/);
});

test("blocks duplicate source rules", () => {
  const result = planPresetSectionReplacements({ presets, bindings, rules: [
    { fromPresetId: "a", toPresetId: "b" },
    { fromPresetId: "a", toPresetId: "b", toVariantId: "b-v2" },
  ] });
  assert.equal(result.hasBlockers, true);
  assert.match(result.globalBlockers[0].message, /重复|Duplicate/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test tests/test-preset-section-replacement-core.test.ts
```

Expected: FAIL because the core module does not exist.

- [ ] **Step 3: Implement the core planner**

Create `src/server/services/preset-section-replacement-core.ts` exporting:

```ts
export type PresetSectionReplacementRule = {
  fromPresetId: string;
  toPresetId: string;
  toVariantId?: string | null;
};

export type PresetReplacementPreset = {
  id: string;
  name: string;
  categoryId: string;
  isActive: boolean;
  variants: Array<{ id: string; name: string; isActive: boolean; sortOrder: number }>;
};

export type PresetReplacementBinding = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerSortOrder: number;
  bindingKey: string;
  categoryId: string;
  presetId: string | null;
  variantId: string | null;
  presetGroupId: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
};
```

Implement `planPresetSectionReplacements({ presets, bindings, rules })` so it returns:

- `rules`: one normalized result per input rule.
- `globalBlockers`: duplicate-source blockers.
- `hasBlockers`.
- `totalPlannedUpdateCount`.

Only include updates for bindings with `presetId === fromPresetId`.

- [ ] **Step 4: Implement Prisma-backed service**

Create `src/server/services/preset-section-replacement-service.ts` exporting:

```ts
export type PresetReplacementTargetType = "project" | "template";

export async function replacePresetSectionBindings(input: {
  targetType: PresetReplacementTargetType;
  targetId: string;
  rules: PresetSectionReplacementRule[];
  dryRun: boolean;
}) { /* load, plan, optionally update, verify */ }
```

Implementation details:

- Load all presets referenced by the rules with active variants sorted by `sortOrder`.
- For project targets, verify the project exists and load `project.sections[].presetBindingRows`.
- For template targets, verify the template exists and load `template.sections[].presetBindingRows`.
- Map section rows into `PresetReplacementBinding`.
- On `dryRun: true`, return the plan.
- On `dryRun: false`, reject if the plan has blockers; otherwise update only planned binding row ids inside one transaction.
- For project rows update `sectionPresetBinding.update({ where: { id }, data: { presetId, variantId } })`.
- For template rows update `templateSectionPresetBinding.update({ where: { id }, data: { presetId, variantId } })`.
- Revalidate `/projects/${targetId}` or `/assets/templates/${targetId}/edit`, plus the relevant collection route.
- Return `{ dryRun, targetType, targetId, initialDryRun, apply, verification }`, where `verification` is a new plan after updates.

- [ ] **Step 5: Add project and template API routes**

Create `src/app/api/projects/[projectId]/preset-replacements/route.ts`:

```ts
import { fail, ok } from "@/lib/api-response";
import { replacePresetSectionBindings } from "@/server/services/preset-section-replacement-service";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }
  try {
    return ok(await replacePresetSectionBindings({
      targetType: "project",
      targetId: projectId,
      rules: Array.isArray((body as { rules?: unknown })?.rules) ? (body as { rules: never[] }).rules : [],
      dryRun: (body as { dryRun?: unknown })?.dryRun !== false,
    }));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Preset replacement failed", 400);
  }
}
```

Create `src/app/api/templates/[templateId]/preset-replacements/route.ts` with the same shape and `targetType: "template"`.

- [ ] **Step 6: Run core tests**

Run:

```bash
npx tsx --test tests/test-preset-section-replacement-core.test.ts
```

Expected: PASS.

### Task 3: Dialog UI And Client Helpers

**Files:**
- Create: `src/lib/preset-section-replacement-ui.ts`
- Create: `src/components/preset-section-replacement-dialog.tsx`
- Test: `tests/test-preset-section-replacement-ui.test.ts`
- Test: `tests/test-preset-section-replacement-dialog-source.test.ts`

- [ ] **Step 1: Write failing UI helper tests**

Create `tests/test-preset-section-replacement-ui.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPresetSectionReplacementPayload,
  summarizePresetSectionReplacementPlan,
} from "../src/lib/preset-section-replacement-ui";

test("buildPresetSectionReplacementPayload trims ids and preserves dryRun", () => {
  assert.deepEqual(buildPresetSectionReplacementPayload({
    dryRun: true,
    rules: [{ fromPresetId: " a ", toPresetId: " b ", toVariantId: " " }],
  }), {
    dryRun: true,
    rules: [{ fromPresetId: "a", toPresetId: "b" }],
  });
});

test("summarizePresetSectionReplacementPlan counts updates, noops, and blockers", () => {
  const summary = summarizePresetSectionReplacementPlan({
    totalPlannedUpdateCount: 2,
    hasBlockers: true,
    rules: [
      { status: "planned", updates: [{}, {}], blockers: [] },
      { status: "noop", updates: [], blockers: [] },
      { status: "blocked", updates: [], blockers: [{ message: "bad" }] },
    ],
    globalBlockers: [],
  });
  assert.deepEqual(summary, { planned: 2, noopRules: 1, blockedRules: 1, blockers: 1 });
});
```

- [ ] **Step 2: Write failing source tests for dialog behavior**

Create `tests/test-preset-section-replacement-dialog-source.test.ts` that reads `src/components/preset-section-replacement-dialog.tsx` and asserts:

```ts
assert.match(source, /createPortal/);
assert.match(source, /Dry Run/);
assert.match(source, /确认 Apply/);
assert.match(source, /setDryRunResult\(null\)/);
assert.match(source, /targetType === "project"/);
assert.match(source, /targetType === "template"/);
assert.match(source, /toVariantId/);
```

- [ ] **Step 3: Run UI tests to verify they fail**

Run:

```bash
npx tsx --test tests/test-preset-section-replacement-ui.test.ts tests/test-preset-section-replacement-dialog-source.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 4: Implement client helper**

Create `src/lib/preset-section-replacement-ui.ts` with:

- `buildPresetSectionReplacementPayload({ dryRun, rules })`
- `summarizePresetSectionReplacementPlan(plan)`
- `extractPresetSectionReplacementError(payload, fallback)`

The payload helper must trim ids, omit blank `toVariantId`, and require nonblank `fromPresetId` and `toPresetId`.

- [ ] **Step 5: Implement reusable dialog**

Create `src/components/preset-section-replacement-dialog.tsx` as a client component.

Props:

```ts
type Props = {
  targetType: "project" | "template";
  targetId: string;
  targetName: string;
  library: PresetLibraryV2;
};
```

Behavior:

- Button label: `批量替换预制`.
- Scope text: `当前项目全部小节` or `当前模板全部小节`.
- Endpoint: `/api/projects/${targetId}/preset-replacements` or `/api/templates/${targetId}/preset-replacements`.
- Replacement rows store `fromPresetId`, `toPresetId`, and optional `toVariantId`.
- The B preset list is filtered to the selected A preset category.
- The B variant list is populated from selected B preset active variants.
- Any row change clears `dryRunResult` and `applyResult`.
- Apply button is disabled until `dryRunResult` exists and has no blockers.
- Apply uses `confirm(...)`, then calls the same endpoint with `dryRun: false`, refreshes the router, and displays verification.

- [ ] **Step 6: Run UI tests**

Run:

```bash
npx tsx --test tests/test-preset-section-replacement-ui.test.ts tests/test-preset-section-replacement-dialog-source.test.ts
```

Expected: PASS.

### Task 4: Wire Project And Template Toolbars

**Files:**
- Modify: `src/app/projects/[projectId]/page.tsx`
- Modify: `src/app/projects/[projectId]/project-detail-client.tsx`
- Modify: `src/app/assets/templates/[templateId]/edit/page.tsx`
- Modify: `src/app/assets/templates/template-form-client.tsx`
- Test: `tests/test-preset-section-replacement-entrypoints.test.ts`

- [ ] **Step 1: Write failing source test**

Create `tests/test-preset-section-replacement-entrypoints.test.ts` that asserts:

```ts
assert.match(projectPageSource, /getPresetLibraryV2/);
assert.match(projectClientSource, /PresetSectionReplacementDialog/);
assert.match(projectClientSource, /targetType="project"/);
assert.match(templatePageSource, /getPresetLibraryV2/);
assert.match(templateClientSource, /PresetSectionReplacementDialog/);
assert.match(templateClientSource, /targetType="template"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test tests/test-preset-section-replacement-entrypoints.test.ts
```

Expected: FAIL because the entry points are not wired.

- [ ] **Step 3: Pass preset library into project detail**

In `src/app/projects/[projectId]/page.tsx`, import and call `getPresetLibraryV2` with `getProjectDetail`, then pass `presetLibrary={library}` to `ProjectDetailClient`.

In `src/app/projects/[projectId]/project-detail-client.tsx`, add `presetLibrary: PresetLibraryV2` to props and render:

```tsx
<PresetSectionReplacementDialog
  targetType="project"
  targetId={projectId}
  targetName={projectTitle}
  library={presetLibrary}
/>
```

Place it in the existing toolbar grid next to `SyncPresetVariantFlowDialog`.

- [ ] **Step 4: Pass preset library into template edit**

In `src/app/assets/templates/[templateId]/edit/page.tsx`, import and call `getPresetLibraryV2` with `getProjectTemplateDetail`, then pass `presetLibrary={library}` to `TemplateFormClient`.

In `src/app/assets/templates/template-form-client.tsx`, add optional `presetLibrary?: PresetLibraryV2` prop and render `PresetSectionReplacementDialog` in the edit toolbar area near `添加小节`:

```tsx
{isEdit && templateId && presetLibrary && (
  <PresetSectionReplacementDialog
    targetType="template"
    targetId={templateId}
    targetName={name}
    library={presetLibrary}
  />
)}
```

- [ ] **Step 5: Run entrypoint test**

Run:

```bash
npx tsx --test tests/test-preset-section-replacement-entrypoints.test.ts
```

Expected: PASS.

### Task 5: Full Verification And Finish

**Files:**
- Verify all files touched by Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx --test \
  tests/test-lora-detach-persistence.test.ts \
  tests/test-preset-section-replacement-core.test.ts \
  tests/test-preset-section-replacement-ui.test.ts \
  tests/test-preset-section-replacement-dialog-source.test.ts \
  tests/test-preset-section-replacement-entrypoints.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run adjacent existing tests**

Run:

```bash
npx tsx --test \
  tests/test-lora-remove-binding.test.ts \
  tests/test-sync-preset-variant-flow-ui.test.ts \
  tests/test-zero-redundancy-section-resolver.test.ts \
  tests/test-zero-redundancy-template-resolver.test.ts \
  tests/test-section-editor-binding-rules.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- src/lib/lora-types.ts src/app/projects/[projectId]/sections/[sectionId]/page.tsx src/server/prompt-config/template-resolver.ts src/server/services/preset-section-replacement-core.ts src/server/services/preset-section-replacement-service.ts src/components/preset-section-replacement-dialog.tsx src/lib/preset-section-replacement-ui.ts
```

Expected: Only this feature's files are changed, plus tests and route files.

- [ ] **Step 5: Commit feature changes only**

Run `git status --short`, then stage only the files from this plan. Do not stage unrelated dirty files already present in the worktree.

Commit message:

```bash
git commit -m "feat: add bulk preset replacement"
```

- [ ] **Step 6: Follow repository deployment rules if this is the final code change batch**

Because this feature changes runtime behavior, use the repository deployment flow from `AGENTS.md` after implementation is complete unless the user explicitly narrows the finish scope before this step.
