# ComfyUI Manager Refactoring Progress Report

**Date:** 2026-03-27  
**Current Phase:** Mixed progress across multiple phases (some complete, some pending)

---

## PHASE CHECKLIST

### ✅ 1. Database Schema (COMPLETE)

**Prisma Schema Updates:**
- ✅ `PromptCategory` model exists (both `.prisma` and `.sqlite.prisma`)
  - Fields: id, name, slug, icon, color, positivePromptOrder, negativePromptOrder, lora1Order, lora2Order, sortOrder, createdAt, updatedAt
  - Relation: has many PromptPreset

- ✅ `PromptPreset` model exists (both schemas)
  - Fields: id, categoryId, name, slug, prompt, negativePrompt, lora1, lora2, defaultParams, notes, isActive, sortOrder
  - Relation: belongs to PromptCategory

- ✅ `CompleteJob.presetBindings` field added
  - Type: Json (nullable)
  - Format: `[{ categoryId, presetId }]`
  - Currently still using legacy fields: characterId, scenePresetId, stylePresetId

- ✅ `PromptBlock.categoryId` field added
  - Type: String (nullable)
  - Allows FK to PromptCategory for unified type system
  - Legacy `type` field still exists: 'character', 'scene', 'style', 'position', 'custom', 'preset'

---

### ✅ 2. Server Actions & Data Functions (COMPLETE)

**Server-side action functions in `src/lib/actions.ts`:**
- ✅ `createPromptCategory(input)` - line 636
- ✅ `updatePromptCategory(id, input)` - line 647
- ✅ `createPromptPreset(input)` - line 690
- ✅ `updatePromptPreset(id, input)` - line 712

**Server-side data functions in `src/lib/server-data.ts`:**
- ✅ `getPromptCategories()` - line 692 → returns `PromptCategoryItem[]`
- ✅ `getPromptPresets(categoryId)` - line 727 → returns `PromptPresetItem[]`
- ✅ `getPromptCategoriesWithPresets()` - line 752 → returns `PromptCategoryFull[]`

---

### ✅ 3. Prompts Management UI (COMPLETE)

- ✅ `src/app/assets/prompts/page.tsx` exists
  - Uses `getPromptCategoriesWithPresets()`
  - Renders `<PromptManager>` component
  - Fully integrated prompt category/preset management page

---

### ✅ 4. Navigation (COMPLETE)

**App Shell Navigation (`src/components/app-shell.tsx`):**
- ✅ "提示词" nav item added at line 10
  - Icon: `BookOpen`
  - Route: `/assets/prompts`
  - Correct position in nav bar (after LoRA, before Settings)

---

### ⚠️  5. Prompt Block Editor (PARTIALLY COMPLETE - USING DYNAMIC CATEGORIES)

**Component: `src/components/prompt-block-editor.tsx`**
- ✅ Uses dynamic categories from database (lines 61-78)
  - `PromptLibraryV2` type accepts dynamic categories array
  - Each category has: id, name, slug, color, icon, presets array

- ✅ Backward compatibility maintained
  - `PromptLibraryLegacy` type still supported (lines 81-86)
  - Hardcoded legacy type config at lines 130-135

- ✅ `TypeBadge` component (lines 141-192)
  - First tries `categoryId` lookup (lines 149-160)
  - Falls back to legacy type names if categoryId missing (lines 163-174)
  - Shows color and icon dynamically from DB

- ✅ Not hardcoded - fully dynamic based on DB categories

---

### ⚠️  6. Job Creation Form (MIXED STATE - LEGACY DROPDOWNS STILL USED)

**File: `src/app/jobs/new/job-create-form.tsx`**
- ✅ Component exists and is functional
- ⚠️ STILL USING OLD SYSTEM:
  - Line 32-38: Single Character dropdown (legacy)
  - Line 42-48: Scene dropdown with presets (legacy)
  - Line 52-58: Style dropdown with presets (legacy)
  - **NOT YET REFACTORED TO:** Dynamic category multi-select
  - **No presetBindings used yet** - still using scenePresetId, stylePresetId

---

### ⚠️  7. Job Edit Form (MIXED STATE - LEGACY DROPDOWNS STILL USED)

**File: `src/app/jobs/[jobId]/edit/job-edit-form.tsx`**
- ✅ Component exists and is functional
- ⚠️ STILL USING OLD SYSTEM:
  - Line 88-98: Character selector (legacy)
  - Line 105-116: Scene dropdown (legacy)
  - Line 120-132: Style dropdown (legacy)
  - **NOT YET REFACTORED TO:** Dynamic category multi-select
  - **No presetBindings handling**

---

### ✅ 7. Job Repository - Config Snapshot (PARTIALLY COMPLETE)

**File: `src/server/repositories/job-repository.ts`**
- ✅ `buildResolvedConfigSnapshot()` function exists (line 342)
  - Takes job, position, blocks, and optional batchSize override
  - Line 417: `promptBlocks: blocks ?? null` - includes blocks in snapshot

- ✅ Returns complete snapshot with:
  - job info, character, scene, style, position, parameters
  - promptBlocks array (lines 417)
  - composed prompt from blocks (line 418)
  - ksampler params (lines 430-431)
  - loraConfig (line 432)

- ⚠️ **LIMITATION:** No direct `presets` array in snapshot
  - Still uses legacy scene/style structure
  - presetBindings from CompleteJob not being serialized into snapshot
  - Snapshot still treats scene/style as special case, not as generic categories

---

### ✅ 8. Payload Builder (COMPLETE)

**File: `src/server/worker/payload-builder.ts`**
- ✅ `normalizeResolvedConfigSnapshot()` function (line 48)
  - Handles new format with blocks
  - Lines 61-68: Parses promptBlocks array correctly
  - Returns `NormalizedResolvedConfigSnapshot` with promptBlocks field

- ✅ `buildComfyPromptDraft()` function (line 132)
  - Uses composedPrompt from blocks (line 136)
  - Falls back to legacy composition if no composedPrompt
  - Passes promptBlocks through metadata system

- ✅ Fully supports new format

---

### ⚠️  9. Old Settings Pages (STILL EXIST - NOT REMOVED)

**Still present in `src/app/settings/`:**
- ✅ `/settings/characters/page.tsx` - exists (modified 3/26 19:09)
- ✅ `/settings/scenes/page.tsx` - exists (modified 3/24 14:14)
- ✅ `/settings/styles/page.tsx` - exists (modified 3/24 14:14)
- ✅ `/settings/positions/page.tsx` - exists (modified 3/26 19:10)

**Note:** These are NOT removed yet. Phase 7 should handle this cleanup.

---

### ❌ 10. Migration Script (NOT CREATED)

- ❌ `prisma/migrate-presets.ts` does NOT exist
- This file should migrate legacy Character/ScenePreset/StylePreset into new PromptCategory/PromptPreset structure
- **Status:** Not yet implemented

---

## RECENT GIT HISTORY (Last 20 commits)

```
4995712 refactor: remove IMAGE_BASE_DIR, always fetch images via ComfyUI API
05e5f6c feat: add upscale factor setting and run button on section detail page
648235c feat: failed run toast notifications and backend log viewer
398cbc7 fix: use fixed label "自定义" for custom prompt blocks
41f10c5 fix: hide fully-reviewed runs from queue list
17aa3d7 fix: use sortOrder-based fallback for unnamed position names and slugs
c3222bf feat: show task completion time in queue review list
62243c9 fix: use 'section' instead of 'Unknown' as position name fallback
e662308 fix: pass promptBlocks to resolvedConfigSnapshot when enqueuing runs
00db9e6 debug: write resolved ComfyUI prompt to debug-submitted-prompt.json
ca088c1 feat: auto-save section params on blur, add empty results placeholder
```

**Observation:** Recent work is focused on:
- PromptBlocks integration (e662308, 398cbc7, e662308)
- UI/UX improvements (upscale factors, custom labels)
- Bug fixes for position names and display

---

## SUMMARY: PHASE COMPLETION STATUS

| Phase | Status | Notes |
|-------|--------|-------|
| 1. DB Schema | ✅ COMPLETE | Both models and fields exist in both schemas |
| 2. Server Actions | ✅ COMPLETE | All CRUD functions implemented |
| 3. Server Data | ✅ COMPLETE | All query functions implemented |
| 4. Prompts UI | ✅ COMPLETE | Full page at `/assets/prompts` |
| 5. Navigation | ✅ COMPLETE | "提示词" added to app shell |
| 6. Block Editor | ✅ COMPLETE | Uses dynamic categories, backward compatible |
| 7. Job Creation | ⚠️ HYBRID | Still uses old dropdowns, not refactored yet |
| 8. Job Editing | ⚠️ HYBRID | Still uses old dropdowns, not refactored yet |
| 9. Config Snapshot | ✅ MOSTLY OK | Includes blocks but not preset array structure |
| 10. Payload Builder | ✅ COMPLETE | Handles new format correctly |
| 11. Old Settings | ⚠️ EXIST | Marked for removal in Phase 7 |
| 12. Migration Script | ❌ MISSING | Not yet created |

---

## NEXT STEPS NEEDED

1. **Create migration script** (`prisma/migrate-presets.ts`)
   - Migrate legacy Character → PromptCategory("角色") with presets
   - Migrate ScenePreset → PromptCategory("场景") with presets
   - Migrate StylePreset → PromptCategory("风格") with presets
   - Migrate PositionTemplate → PromptCategory("镜位") with presets

2. **Refactor job creation/edit forms**
   - Replace separate Scene/Style dropdowns with dynamic multi-category selector
   - Use presetBindings instead of scenePresetId, stylePresetId
   - Update form logic to handle array of category selections

3. **Update config snapshot builder**
   - Include full presets array in snapshot (not just legacy scene/style)
   - Serialize presetBindings when available

4. **Clean up old settings pages** (Phase 7)
   - Remove `/settings/characters/`
   - Remove `/settings/scenes/`
   - Remove `/settings/styles/`
   - Remove `/settings/positions/` or refactor for new unified category system

5. **Remove legacy models** (Phase 7+)
   - Character, ScenePreset, StylePreset, PositionTemplate (after verified migration)
   - Update CompleteJob to remove legacy fields
   - Update PromptBlock to use only categoryId/preset type
