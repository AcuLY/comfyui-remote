# Split character-lora-training-repository.ts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 5,408-line monolithic `character-lora-training-repository.ts` into ~13 focused domain files under a new `character-lora-training/` directory while maintaining full backward compatibility.

**Architecture:** Create a directory module with domain-specific files. Each file imports shared types/helpers as needed. A barrel `index.ts` re-exports everything. The original file becomes a one-line re-export for backward compat so all existing importers continue working unchanged.

**Tech Stack:** TypeScript, Prisma ORM, Next.js path aliases (`@/`)

---

## File Structure

```
src/server/repositories/character-lora-training/
├── types.ts                    (~620 lines) - SELECT constants, Record types, exported input/summary types, constants
├── serializers.ts              (~470 lines) - All serialize* functions
├── helpers.ts                  (~250 lines) - Small utility functions
├── benchmark-helpers.ts        (~380 lines) - Benchmark matrix/template helpers
├── job-repository.ts           (~200 lines) - Job + training template CRUD
├── source-image-repository.ts  (~300 lines) - Source image CRUD + artifact creation
├── canonical-repository.ts     (~400 lines) - Canonical version + prompt card version + generation run
├── section-repository.ts       (~450 lines) - Section templates + job sections + section gen runs + candidate images
├── dataset-repository.ts       (~300 lines) - Dataset revision CRUD + freeze
├── training-run-repository.ts  (~350 lines) - Training run CRUD + cancel + GPU locks
├── benchmark-repository.ts     (~600 lines) - Benchmark run create/list/get/complete/cleanup + template functions
├── promotion-repository.ts     (~400 lines) - Promotion decision + lora asset + linked variant
├── worker-task-repository.ts   (~700 lines) - Worker task queue: lease, heartbeat, complete, fail, status
└── index.ts                    (~30 lines)  - Re-export everything
```

After: `src/server/repositories/character-lora-training-repository.ts` → single line: `export * from "./character-lora-training/index";`

---

## Dependency Graph (import order)

```
types.ts (no internal deps)
    ↓
helpers.ts (imports from ./types)
    ↓
benchmark-helpers.ts (imports from ./types, ./helpers)
    ↓
serializers.ts (imports from ./types, ./helpers)
    ↓
[all domain repositories] (import from ./types, ./helpers, ./benchmark-helpers, ./serializers)
```

---

## Task 1: Create `types.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/types.ts`

This file contains ALL constants and type definitions. No function implementations.

- [ ] **Step 1: Create types.ts with imports, constants, SELECT objects, Record types, and exported input/summary types**

```typescript
import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraDecisionStatus,
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
  RunStatus,
} from "@/generated/prisma/enums";
import type {
  CharacterLoraArtifactKind,
  CharacterLoraDatasetFreezeTaskPayload,
  CharacterLoraImageGenerationOutput,
  CharacterLoraImageGenerationTaskPayload,
  CharacterLoraBenchmarkTaskPayload,
  CharacterLoraPromptCardDraftTaskPayload,
  CharacterLoraPromotionReturnPoint,
  CharacterLoraTrainingCompleteOutput,
  CharacterLoraTrainingTaskPayload,
} from "@/server/character-lora-training/contracts";
```

Include (copy verbatim from original, lines 25-617):
- All `CHARACTER_LORA_BENCHMARK_TEMPLATE_*` constants (lines 25-42)
- All `*_SELECT` constants (lines 44-413) — export each one
- All `*Record` type aliases (lines 415-481) — export each one
- All exported input/summary type aliases (lines 483-617) — keep `export` keyword
- The `SECTION_TEMPLATE_KEY_MAX_LENGTH` and `SECTION_TEMPLATE_NAME_MAX_LENGTH` constants (lines 4716-4717)

**Important:** The type aliases like `CharacterLoraTrainingJobSummary = ReturnType<typeof serializeJobSummary>` reference serializer functions. These must be changed to use explicit type definitions instead of `ReturnType<>`, OR we can use a forward-declaration pattern. The simplest approach: keep these types in `serializers.ts` instead and re-export from types.ts... Actually the cleanest approach is to define these ReturnType types in `serializers.ts` since that's where the functions live, then re-export from the barrel.

**Revised approach:** Move the `ReturnType<typeof serialize*>` type aliases to `serializers.ts` where the functions are defined. In `types.ts`, only include:
- Constants (both `CHARACTER_LORA_BENCHMARK_TEMPLATE_*` and `SECTION_TEMPLATE_*_MAX_LENGTH`)
- `*_SELECT` constants
- `*Record` type aliases
- Exported input types (`*CreateInput`, `*UpdateInput`, `*ListFilters`, `*UpsertInput`, `*StatusPatch`, `*Blocker`, `*Result`)
- Re-export enum imports so domain files can use them

- [ ] **Step 2: Verify types.ts compiles in isolation**

Run: `cd /Users/luca/dev/comfyui-remote && npx tsc --noEmit src/server/repositories/character-lora-training/types.ts 2>&1 | head -20`

If it fails, fix import paths. The file should compile cleanly since it only uses Prisma types and contracts.

---

## Task 2: Create `helpers.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/helpers.ts`

Contains small utility functions that have no Prisma `db` calls and no domain logic. These are pure functions or simple helpers.

- [ ] **Step 1: Create helpers.ts**

Import from `./types` as needed, plus:
```typescript
import { Prisma } from "@/generated/prisma";
import { detectProvider } from "@/lib/prisma";
```

Include these functions (copy verbatim from original):
- `ciContains` (line 4359-4363)
- `slugifyForRepository` (line 4444-4453)
- `toInputJsonValue` (line 5399-5401) — export it
- `readJsonRecord` (line 4647-4651) — export it
- `asJsonRecord` (line 5403-5407) — export it
- `cloneJsonValueForRepository` (line 4455-4459)
- `truncateWithFallback` (line 4761-4764)
- `appendNumberedSuffix` (line 4766-4769)
- `isUniqueConstraintError` (line 4771-4773)
- `isTemporaryBenchmarkResourceNotes` (line 5383-5397)
- `extractTargetSteps` (line 5332-5344)
- `extractTrainingProgressUpdate` (line 5346-5368)
- `hasCancelRequested` (line 5370-5376)
- `extractCompletionStep` (line 5378-5381)
- `deriveActiveSectionStatus` (line 4333-4347)
- `buildDefaultCaption` (line 4349-4357)
- `countWorkerTasks` (line 5291-5296)
- `latestIsoDate` (line 5298-5307)
- `oldestIsoDate` (line 5309-5317)
- `mapRejectedPromotionReturnPointToJobStatus` (line 5213-5225)
- `mapRejectedPromotionReturnPointToJobPhase` (line 5227-5238)

All functions should be exported.

---

## Task 3: Create `benchmark-helpers.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/benchmark-helpers.ts`

Contains benchmark-related pure/helper functions (matrix math, formatting, template building).

- [ ] **Step 1: Create benchmark-helpers.ts**

Imports:
```typescript
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import {
  CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_DESCRIPTION,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_SECTIONS,
  BENCHMARK_TEMPLATE_SELECT,
} from "./types";
import { toInputJsonValue, readJsonRecord } from "./helpers";
```

Include these functions (all exported):
- `roundBenchmarkWeight` (line 4673-4675)
- `formatBenchmarkWeight` (line 4669-4671)
- `shortCheckpointName` (line 4665-4667)
- `inferStringIndex` (line 4653-4657)
- `inferNumberIndex` (line 4659-4663)
- `readStringArrayFromJson` (line 4634-4638)
- `readNumberArrayFromJson` (line 4640-4645)
- `readLoraWeight` (line 4619-4632)
- `readBenchmarkMetadata` (line 4598-4617)
- `buildBenchmarkMatrixItems` (line 4461-4470)
- `buildBenchmarkSectionMetadata` (line 4473-4491)
- `decorateBenchmarkPromptBlocks` (line 4493-4507)
- `buildBenchmarkExtraParams` (line 4509-4518)
- `buildBenchmarkSectionLoraConfig` (line 4520-4525)
- `makeBenchmarkSectionLoraEntry` (line 4527-4539)
- `buildBenchmarkMatrixExpansionSummary` (line 4541-4596)
- `normalizeTemplatePromptBlocks` (line 4677-4704)
- `buildBenchmarkTemplateStatus` (line 4706-4714) — needs `serializeBenchmarkTemplate` return type; accept `template` parameter as the serialized shape
- `normalizeOptionalTemplateCheckpointName` (line 4842-4849)
- `buildCharacterLoraBenchmarkTemplateSections` (line 4795-4840)
- `buildCharacterLoraBenchmarkTemplateWhere` (line 4789-4793)
- `findPreferredCharacterLoraBenchmarkTemplate` (line 4775-4787) — this one does a DB call, so it needs `db` or a client param; include it here since it's benchmark-specific

---

## Task 4: Create `serializers.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/serializers.ts`

Contains all `serialize*` functions and the `ReturnType<>` type aliases.

- [ ] **Step 1: Create serializers.ts**

Imports:
```typescript
import {
  CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
  type JobSummaryRecord,
  type TrainingTemplateRecord,
  type SourceImageRecord,
  type ArtifactRefRecord,
  type GenerationRunRecord,
  type CanonicalVersionRecord,
  type PromptCardVersionRecord,
  type SectionTemplateRecord,
  type JobSectionRecord,
  type CandidateImageRecord,
  type DatasetRevisionRecord,
  type TrainingRunRecord,
  type BenchmarkRunRecord,
  type PromotionDecisionRecord,
  type WorkerTaskRecord,
  type GpuTaskLockRecord,
  type BenchmarkTemplateRecord,
} from "./types";
```

Include these functions (all exported):
- `serializeBenchmarkTemplate` (line 4851-4862)
- `serializeJobSummary` (line 4864-4904)
- `serializeTrainingTemplate` (line 4906-4928)
- `serializeSourceImage` (line 4930-4945)
- `serializeArtifactRef` (line 4947-4961)
- `serializeGenerationRun` (line 4963-4992)
- `serializeCanonicalVersion` (line 4994-5007)
- `serializePromptCardVersion` (line 5009-5023)
- `serializeSectionTemplate` (line 5025-5040)
- `serializeJobSection` (line 5042-5076)
- `serializeCandidateImage` (line 5078-5100)
- `serializeDatasetRevision` (line 5102-5127)
- `serializeTrainingRun` (line 5128-5156)
- `serializeBenchmarkRun` (line 5158-5188)
- `serializePromotionDecision` (line 5190-5211)
- `serializeLoraAsset` (line 5241-5267)
- `serializeWorkerTask` (line 5269-5289)
- `serializeGpuTaskLock` (line 5319-5330)

Then add the exported type aliases (originally from lines 539-555):
```typescript
export type CharacterLoraTrainingJobSummary = ReturnType<typeof serializeJobSummary>;
export type CharacterLoraTrainingTemplateSummary = ReturnType<typeof serializeTrainingTemplate>;
// ... etc
```

---

## Task 5: Create `job-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/job-repository.ts`

Contains job CRUD + training template management.

- [ ] **Step 1: Create job-repository.ts**

Imports:
```typescript
import { Prisma } from "@/generated/prisma";
import { CharacterLoraJobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  JOB_SUMMARY_SELECT,
  TRAINING_TEMPLATE_SELECT,
  type CharacterLoraTrainingJobCreateInput,
  type CharacterLoraTrainingJobUpdateInput,
  type CharacterLoraTrainingJobListFilters,
  type CharacterLoraTrainingTemplateUpsertInput,
} from "./types";
import { ciContains } from "./helpers";
import { serializeJobSummary, serializeTrainingTemplate } from "./serializers";
```

Include these exported functions (verbatim from original):
- `listCharacterLoraTrainingJobs` (lines 619-656) — exported as `listCharacterLoraJobs` originally named `listCharacterLoraTrainingJobs`
- `getCharacterLoraTrainingJob` (lines 658-665)
- `findCharacterLoraTrainingJobBySlug` (lines 667-672)
- `findActiveCharacterLoraTrainingJobByTriggerToken` (lines 674-692)
- `createCharacterLoraTrainingJob` (lines 694-701)
- `updateCharacterLoraTrainingJob` (lines 703-711)
- `archiveCharacterLoraTrainingJob` (lines 713-727)
- `upsertCharacterLoraTrainingTemplates` (lines 729-744)
- `getCharacterLoraTrainingTemplate` (lines 746-763)
- `listActiveCharacterLoraTrainingTemplates` (lines 765-773)

---

## Task 6: Create `source-image-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/source-image-repository.ts`

- [ ] **Step 1: Create source-image-repository.ts**

Imports:
```typescript
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraArtifactKind } from "@/server/character-lora-training/contracts";
import {
  SOURCE_IMAGE_SELECT,
  ARTIFACT_REF_SELECT,
  GENERATION_RUN_SUMMARY_SELECT,
  CANDIDATE_IMAGE_SELECT,
  type CharacterLoraSourceImageCreateInput,
} from "./types";
import { toInputJsonValue } from "./helpers";
import { serializeSourceImage, serializeArtifactRef, serializeGenerationRun, serializeCandidateImage } from "./serializers";
```

Include these exported functions (verbatim):
- `listCharacterLoraSourceImages` (lines 775-783)
- `getCharacterLoraSourceImage` (lines 785-792)
- `listCharacterLoraSourceImagesByIds` (lines 794-808)
- `findCharacterLoraSourceImageDuplicate` (lines 810-825)
- `createCharacterLoraSourceImage` (lines 827-861)
- `registerCharacterLoraSourceImageAsCandidate` (lines 863-991)
- `createCharacterLoraJobArtifact` (lines 993-1018)
- `getCharacterLoraArtifact` (lines 1020-1027)
- `deleteCharacterLoraSourceImage` — if it exists (check original; it's listed in plan but not found in source — skip if absent)
- `updateCharacterLoraSourceImageCaption` — if it exists (not in source — skip if absent)

---

## Task 7: Create `canonical-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/canonical-repository.ts`

- [ ] **Step 1: Create canonical-repository.ts**

Contains canonical version management + prompt card versions + generation run get/create.

Include these exported functions (verbatim):
- `getCharacterLoraGenerationRun` (lines 1029-1036)
- `createCharacterLoraCanonicalGenerationRunWithTask` (lines 1038-1127)
- `createMockCompletedCanonicalVersion` (lines 1129-1184)
- `createManualCanonicalVersionFromSourceImage` (lines 1186-1214)
- `getCharacterLoraCanonicalVersion` (lines 1216-1223)
- `listCharacterLoraCanonicalVersions` (lines 1225-1233)
- `rejectCharacterLoraCanonicalVersion` (lines 1235-1262)
- `selectCharacterLoraCanonicalVersion` (lines 1264-1306)
- `listCharacterLoraPromptCardVersions` (lines 1308-1316)
- `getCharacterLoraPromptCardVersion` (lines 1318-1325)
- `createCharacterLoraPromptCardVersion` (lines 1327-1373)

---

## Task 8: Create `section-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/section-repository.ts`

- [ ] **Step 1: Create section-repository.ts**

Contains section template management, job section operations, section generation runs, and candidate image CRUD.

Include these exported functions (verbatim):
- Type: `CharacterLoraSectionTemplateUpsertInput` (lines 1375-1387)
- Type: `CharacterLoraSectionTemplateCopyCreateInput` (lines 1389-1400)
- `upsertCharacterLoraSectionTemplates` (lines 1402-1417)
- `getCharacterLoraSectionTemplate` (lines 1419-1436)
- `createCharacterLoraSectionTemplateCopy` (lines 1438-1481)
- `listActiveCharacterLoraSectionTemplates` (lines 1483-1498)
- `listCharacterLoraJobSections` (lines 1500-1508)
- `instantiateCharacterLoraJobSections` (lines 1510-1605)
- `getCharacterLoraJobSection` (lines 1607-1614)
- `updateCharacterLoraJobSectionStatus` (lines 1616-1652)
- `createCharacterLoraSectionGenerationRunWithTask` (lines 1654-1750)
- `listCharacterLoraCandidateImages` (lines 1752-1767)
- `getCharacterLoraCandidateImage` (lines 1769-1776)
- `reviewCharacterLoraCandidateImages` (lines 1778-1838)
- `updateCharacterLoraCandidateCaption` (lines 1840-1851)

Also include private helpers that are section-specific:
- `findAvailableSectionTemplateKey` (lines 4719-4738)
- `findAvailableSectionTemplateName` (lines 4740-4759)

---

## Task 9: Create `dataset-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/dataset-repository.ts`

- [ ] **Step 1: Create dataset-repository.ts**

Contains dataset revision CRUD and frozen revision creation.

Include these exported functions (verbatim):
- `getCharacterLoraDatasetRevision` (lines 1853-1860)
- `listCharacterLoraDatasetRevisions` (lines 4096-4104)
- `getNextCharacterLoraDatasetRevisionVersion` (lines 4106-4114)
- `createFrozenCharacterLoraDatasetRevision` (lines 4116-4122)
- Private: `createFrozenCharacterLoraDatasetRevisionInTx` (lines 4220-4291) — export it so worker-task-repository can use it
- Private: `refreshSectionCounts` (lines 4293-4331) — export it so it can be used by section-repository and worker-task-repository

---

## Task 10: Create `training-run-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/training-run-repository.ts`

- [ ] **Step 1: Create training-run-repository.ts**

Contains training run CRUD, create-with-task, cancel, and GPU lock queries.

Include these exported functions (verbatim):
- `listCharacterLoraTrainingRuns` (lines 1862-1870)
- `getCharacterLoraTrainingRun` (lines 1872-1879)
- `getCharacterLoraTrainingRunWithFinalArtifact` (lines 1881-1895)
- `createCharacterLoraTrainingRunWithTask` (lines 2965-3081)
- `cancelCharacterLoraTrainingRun` (lines 3961-4094)
- `listActiveCharacterLoraGpuTaskLocks` (lines 2945-2953)
- `getCurrentCharacterLoraGpuTaskLock` (lines 2955-2963)
- `countActiveComfyQueueRuns` (lines 2936-2943)

---

## Task 11: Create `benchmark-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/benchmark-repository.ts`

- [ ] **Step 1: Create benchmark-repository.ts**

Contains benchmark run create/list/get/complete/cleanup + template ensure/get/find.

Include these exported functions (verbatim):
- `createCharacterLoraBenchmarkRunWithTask` (lines 1950-2224) — the large function
- `listCharacterLoraBenchmarkRunsByJob` (lines 2226-2234)
- `listCharacterLoraBenchmarkRunsByTrainingRun` (lines 2236-2244)
- `getCharacterLoraBenchmarkRun` (lines 2246-2253)
- `getCharacterLoraBenchmarkMatrixExpansionSummary` (lines 2255-2293)
- `completeCharacterLoraBenchmarkRunInRepository` (lines 2295-2383)
- `cleanupCharacterLoraBenchmarkTemporaryResourcesInRepository` (lines 2385-2571)
- `findCharacterLoraBenchmarkTemplate` (lines 2837-2839)
- `getCharacterLoraBenchmarkTemplateStatusInRepository` (lines 2842-2845)
- `ensureCharacterLoraBenchmarkTemplateInRepository` (lines 2847-2886)
- `getCharacterLoraBenchmarkTemplateById` (lines 2888-2895)
- Private: `ensurePresetCategory` (lines 4365-4404) — export it for promotion-repository too

---

## Task 12: Create `promotion-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/promotion-repository.ts`

- [ ] **Step 1: Create promotion-repository.ts**

Contains promotion decision CRUD, promote, lora asset, and linked variant queries.

Include these exported functions (verbatim):
- `upsertCharacterLoraAsset` (lines 1897-1948)
- `createCharacterLoraPromotionDecisionInRepository` (lines 2573-2632)
- `listCharacterLoraPromotionDecisions` (lines 2634-2642)
- `getCharacterLoraPromotionDecisionForPromotion` (lines 2644-2674)
- `getLoraAssetById` (lines 2676-2695)
- `promoteCharacterLoraDecisionInRepository` (lines 2697-2835)
- `findCharacterLoraPromotionLinkedVariant` (lines 2897-2917)
- `findBreastSizeSliderLoraAsset` (lines 2919-2934)

---

## Task 13: Create `worker-task-repository.ts`

**Files:**
- Create: `src/server/repositories/character-lora-training/worker-task-repository.ts`

- [ ] **Step 1: Create worker-task-repository.ts**

Contains all worker task queue operations.

Include these exported functions (verbatim):
- `createCharacterLoraDatasetFreezeWorkerTask` (lines 3083-3114)
- `createCharacterLoraPromptCardDraftWorkerTask` (lines 3116-3154)
- `leaseNextCharacterLoraWorkerTask` (lines 3156-3275)
- `getCharacterLoraWorkerTask` (lines 3277-3284)
- `getCharacterLoraWorkerTaskForTarget` (lines 3286-3301)
- `getCharacterLoraWorkerQueueStatus` (lines 3303-3359)
- `heartbeatCharacterLoraWorkerTask` (lines 3361-3415)
- `completeImageGenerationWorkerTask` (lines 3418-3604)
- `completeTrainingWorkerTask` (lines 3606-3806)
- `failCharacterLoraWorkerTask` (lines 3808-3958)
- `completeDatasetFreezeWorkerTask` (lines 4124-4180)
- `completePromptCardDraftWorkerTask` (lines 4182-4218)

---

## Task 14: Create `index.ts` barrel and update original file

**Files:**
- Create: `src/server/repositories/character-lora-training/index.ts`
- Modify: `src/server/repositories/character-lora-training-repository.ts`

- [ ] **Step 1: Create index.ts**

```typescript
export * from "./types";
export * from "./helpers";
export * from "./benchmark-helpers";
export * from "./serializers";
export * from "./job-repository";
export * from "./source-image-repository";
export * from "./canonical-repository";
export * from "./section-repository";
export * from "./dataset-repository";
export * from "./training-run-repository";
export * from "./benchmark-repository";
export * from "./promotion-repository";
export * from "./worker-task-repository";
```

- [ ] **Step 2: Replace original file content**

Replace the entire content of `src/server/repositories/character-lora-training-repository.ts` with:
```typescript
export * from "./character-lora-training/index";
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/character-lora-training/
git add src/server/repositories/character-lora-training-repository.ts
git commit -m "refactor: split character-lora-training-repository into domain modules"
```

---

## Cross-cutting Concerns

### Shared functions used across multiple domain files

These functions are used by multiple domain repositories:
- `toInputJsonValue` → used everywhere → in `helpers.ts`, exported
- `readJsonRecord` → used by benchmark-helpers and some repos → in `helpers.ts`, exported
- `asJsonRecord` → used in worker-task-repository → in `helpers.ts`, exported
- `cloneJsonValueForRepository` → used in benchmark-repository → in `helpers.ts`, exported
- `ciContains` → used in job-repository → in `helpers.ts`, exported
- `refreshSectionCounts` → used in section-repository, dataset-repository, worker-task-repository → in `dataset-repository.ts`, exported
- `deriveActiveSectionStatus` → used in section-repository, dataset-repository → in `helpers.ts`, exported
- `buildDefaultCaption` → used in worker-task-repository → in `helpers.ts`, exported
- `ensurePresetCategory` → used in benchmark-repository, promotion-repository → in `benchmark-repository.ts`, exported
- `resolveUniquePresetSlug` → used in benchmark-repository, promotion-repository → in `benchmark-repository.ts`, exported
- `resolveUniqueProjectSlugForRepository` → used in benchmark-repository → in `benchmark-repository.ts`, exported
- `isTemporaryBenchmarkResourceNotes` → used in benchmark-repository → in `helpers.ts`, exported
- `isUniqueConstraintError` → used in section-repository → in `helpers.ts`, exported
- `createFrozenCharacterLoraDatasetRevisionInTx` → used in dataset-repository, worker-task-repository → in `dataset-repository.ts`, exported

### Export visibility rules
- All functions that were `export`ed in the original remain exported from the new location
- All functions that were module-private (no `export`) become exported if they're needed by other sub-modules within the directory, but this is fine since the barrel controls what's visible externally
- Since we use `export *` in the barrel, all exported members become publicly visible — same as original behavior

### Type alias approach for ReturnType exports
The `CharacterLoraTrainingJobSummary = ReturnType<typeof serializeJobSummary>` types will live in `serializers.ts` alongside the functions they reference. The barrel re-exports them.
