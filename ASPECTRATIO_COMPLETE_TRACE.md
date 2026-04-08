# Complete AspectRatio Injection Trace

## Overview
This document traces the complete flow of the `aspectRatio` (画幅) parameter from the database through to the final ComfyUI workflow JSON.

---

## 1. DATABASE SCHEMA - AspectRatio Storage

### File: `/prisma/schema.prisma`
**Lines: 173-199**

```prisma
model ProjectSection {
  id                    String                @id @default(cuid())
  projectId             String
  name                  String?
  sortOrder             Int                   @default(0)
  enabled               Boolean               @default(true)
  positivePrompt        String?               @db.Text
  negativePrompt        String?               @db.Text
  aspectRatio           String?               // ← STORED HERE (Line 181)
  shortSidePx           Int?
  batchSize             Int?
  seedPolicy1           String?
  seedPolicy2           String?
  ksampler1             Json?
  ksampler2             Json?
  upscaleFactor         Float?
  loraConfig            Json?
  extraParams           Json?
  latestRunId           String?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  project               Project               @relation(...)
  runs                  Run[]
  promptBlocks          PromptBlock[]
  @@index([projectId, sortOrder])
}
```

**Key Column:**
- `aspectRatio: String?` (Line 181) - stores values like "1:1", "2:3", "3:4", "9:16", "3:2", "4:3", "16:9"

---

## 2. UI FORM INPUT - How AspectRatio is Set

### File: `/src/app/projects/[projectId]/sections/[sectionId]/edit/section-edit-form.tsx`
**Lines: 87-104**

```tsx
<div className="space-y-2">
  <label className="text-xs text-zinc-400">画幅</label>
  <div className="relative">
    <select
      name="aspectRatio"
      disabled={pending}
      defaultValue={section.aspectRatio ?? "2:3"}
      className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40 disabled:opacity-70"
    >
      <option value="1:1" className="bg-zinc-900">1:1 方形</option>
      <option value="2:3" className="bg-zinc-900">2:3 竖图</option>
      <option value="3:4" className="bg-zinc-900">3:4 竖图</option>
      <option value="9:16" className="bg-zinc-900">9:16 竖图</option>
      <option value="3:2" className="bg-zinc-900">3:2 横图</option>
      <option value="4:3" className="bg-zinc-900">4:3 横图</option>
      <option value="16:9" className="bg-zinc-900">16:9 横图</option>
    </select>
```

---

## 3. SAVING TO DATABASE

### File: `/src/app/projects/actions.ts`
The form submission sends `aspectRatio` to the `saveSectionEditAction` which saves it to the ProjectSection table.

---

## 4. ASPECT RATIO DEFINITION & RESOLUTION

### File: `/src/lib/aspect-ratio-utils.ts`
**Lines: 1-87**

This is the KEY utility file that defines aspect ratio mappings and resolution calculation.

#### Defined Aspect Ratios (Lines 12-23):
```typescript
export const ASPECT_RATIOS: Record<
  string,
  { width: number; height: number; ratioW: number; ratioH: number }
> = {
  "1:1":  { width: 1024, height: 1024, ratioW: 1,  ratioH: 1  },
  "3:4":  { width: 896,  height: 1152, ratioW: 3,  ratioH: 4  },
  "4:3":  { width: 1152, height: 896,  ratioW: 4,  ratioH: 3  },
  "9:16": { width: 768,  height: 1344, ratioW: 9,  ratioH: 16 },
  "16:9": { width: 1344, height: 768,  ratioW: 16, ratioH: 9  },
  "2:3":  { width: 832,  height: 1216, ratioW: 2,  ratioH: 3  },
  "3:2":  { width: 1216, height: 832,  ratioW: 3,  ratioH: 2  },
};
```

#### Resolution Resolver (Lines 42-68):
```typescript
export function resolveResolution(
  aspectRatio: string | null | undefined,
  shortSidePx?: number | null,
): { width: number; height: number } {
  const entry = ASPECT_RATIOS[aspectRatio ?? DEFAULT_RATIO] ?? ASPECT_RATIOS[DEFAULT_RATIO];

  if (!shortSidePx || shortSidePx <= 0) {
    return { width: entry.width, height: entry.height };
  }

  // Custom resolution calculation:
  // - If shortSidePx is provided, use it and calculate long side from ratio
  // - Round to nearest multiple of 8 (for latent space alignment)
  if (entry.ratioW === entry.ratioH) {
    const side = roundTo8(shortSidePx);
    return { width: side, height: side };
  }

  const isPortrait = entry.height > entry.width;
  const ratioLong = Math.max(entry.ratioW, entry.ratioH);
  const ratioShort = Math.min(entry.ratioW, entry.ratioH);

  const shortSide = roundTo8(shortSidePx);
  const longSide = roundTo8(shortSide * (ratioLong / ratioShort));

  return isPortrait
    ? { width: shortSide, height: longSide }
    : { width: longSide, height: shortSide };
}
```

**Key Points:**
- Default ratio: "3:4" (Line 25)
- Rounds dimensions to multiple of 8 (Line 74-77)
- Takes `aspectRatio` string and optional `shortSidePx` override
- Returns `{ width, height }` suitable for ComfyUI

---

## 5. QUEUING A RUN - Building resolvedConfigSnapshot

### File: `/src/server/repositories/project-repository.ts`
**Lines: 273-351**

When a run is queued, `buildResolvedConfigSnapshot` is called (Line 532):

```typescript
function buildResolvedConfigSnapshot(
  project: QueuableProjectRecord,
  section: ProjectSectionRecord,
  blocks?: Array<{ positive: string; negative: string | null; ... }>,
  overrideBatchSize?: number,
): Prisma.InputJsonObject {
  const projectLevelOverrides = toInputJsonObject(project.projectLevelOverrides);
  
  // RESOLUTION 1: Section override takes precedence
  // RESOLUTION 2: Fall back to project-level override
  // RESOLUTION 3: Fall back to null
  const resolvedAspectRatio =
    section.aspectRatio ??
    resolveProjectOverrideString(projectLevelOverrides, "aspectRatio") ??
    null;
  
  const resolvedShortSidePx =
    section.shortSidePx ??
    resolveProjectOverrideInteger(projectLevelOverrides, "shortSidePx") ??
    null;

  // ... more fields ...

  return {
    project: { id, title, slug },
    section: { id, templateId, sortOrder, name, ... },
    promptBlocks: blocks ?? null,
    composedPrompt: promptDraft,
    parameters: {
      aspectRatio: resolvedAspectRatio,        // ← STORED HERE (Line 337)
      shortSidePx: resolvedShortSidePx,        // ← STORED HERE (Line 338)
      batchSize: resolvedBatchSize,
      seedPolicy: resolvedSeedPolicy1,
      seedPolicy1: resolvedSeedPolicy1,
      seedPolicy2: resolvedSeedPolicy2,
      upscaleFactor: section.upscaleFactor ?? null,
    },
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    loraConfig: section.loraConfig,
    extraParams: section.extraParams ? JSON.parse(JSON.stringify(...)) : null,
  };
}
```

**The resolvedConfigSnapshot is stored in the Run record (Line 532):**
```typescript
const createdRun = await tx.run.create({
  data: {
    projectId: project.id,
    projectSectionId: section.id,
    runIndex: ...,
    status: "queued",
    resolvedConfigSnapshot: buildResolvedConfigSnapshot(project, section, section.promptBlocks, overrideBatchSize),
  },
  select: { id: true, runIndex: true, status: true, createdAt: true },
});
```

---

## 6. READING PARAMETERS - WorkerRunSnapshot

### File: `/src/server/worker/repository.ts`
**Lines: 143-154**

When a run is picked from the queue:

```typescript
export async function listQueuedWorkerRuns(limit = 10): Promise<WorkerRunSnapshot[]> {
  const runs = await db.run.findMany({
    where: { status: RunStatus.queued },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    include: workerRunInclude,
  });

  return runs.map(serializeWorkerRunSnapshot);
}

function serializeWorkerRunSnapshot(run: WorkerRunRecord): WorkerRunSnapshot {
  return {
    runId: run.id,
    runIndex: run.runIndex,
    status: run.status,
    workflowId: run.project.slug,
    comfyApiUrl: env.comfyApiUrl,
    outputDir: run.outputDir,
    resolvedConfigSnapshot: run.resolvedConfigSnapshot,  // ← FROM DATABASE
    project: { id, title, slug },
    section: { id, name, slug },
  };
}
```

### File: `/src/server/worker/types.ts`
**Lines: 66-99**

The `ComfyPromptDraft` type defines the structure:

```typescript
export type ComfyPromptDraft = {
  clientId: string;
  workflowId: string;
  prompt: {
    positive: string;
    negative: string | null;
  };
  parameters: {
    aspectRatio: string | null;          // ← FROM resolvedConfigSnapshot (Line 74)
    shortSidePx: number | null;          // ← FROM resolvedConfigSnapshot (Line 75)
    batchSize: number | null;
    seedPolicy: string | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    upscaleFactor: number | null;
  };
  ksampler1: Prisma.JsonObject | null;
  ksampler2: Prisma.JsonObject | null;
  loraConfig: Prisma.JsonObject | null;
  extraParams: Prisma.JsonObject | null;
  metadata: {
    runId: string;
    runIndex: number;
    projectId: string;
    projectTitle: string;
    sectionId: string;
    sectionName: string;
    sectionSortOrder: number;
  };
};
```

---

## 7. PAYLOAD BUILDER - From Snapshot to Draft

### File: `/src/server/worker/payload-builder.ts`
**Lines: 103-132**

```typescript
export function buildComfyPromptDraft(run: WorkerRunSnapshot): ComfyPromptDraft {
  const resolvedConfig = normalizeResolvedConfigSnapshot(run.resolvedConfigSnapshot);

  // Prefer composedPrompt from blocks (v0.2), fall back to legacy composition
  const positive = resolvedConfig.composedPrompt?.positive ?? composePositivePrompt(resolvedConfig);
  const negative = resolvedConfig.composedPrompt?.negative ?? resolvedConfig.section.negativePrompt;

  return {
    clientId: `run-${run.runId}`,
    workflowId: run.workflowId,
    prompt: {
      positive,
      negative,
    },
    parameters: resolvedConfig.parameters,  // ← aspectRatio, shortSidePx, batchSize, etc.
    ksampler1: resolvedConfig.ksampler1,
    ksampler2: resolvedConfig.ksampler2,
    loraConfig: resolvedConfig.loraConfig,
    extraParams: resolvedConfig.extraParams,
    metadata: { runId, runIndex, projectId, projectTitle, sectionId, sectionName, sectionSortOrder },
  };
}
```

**The parameters object (including aspectRatio) is passed through directly from resolvedConfig.parameters**

---

## 8. RUN EXECUTOR - Building and Validating Draft

### File: `/src/server/services/run-executor.ts`
**Lines: 128-134**

```typescript
const promptDraft = buildComfyPromptDraft(run);
const validatedDraft = await validateComfyPromptDraft(
  run.comfyApiUrl,
  promptDraft,
);
const comfyPromptId = await submitComfyPrompt(validatedDraft, promptDraft);
```

---

## 9. COMFYUI SERVICE - Resolving Width/Height from AspectRatio

### File: `/src/server/services/comfyui-service.ts`
**Lines: 454-504**

This is where aspectRatio is CONVERTED to actual pixel values:

#### resolveStandardWorkflowPrompt (Lines 454-504):
```typescript
async function resolveStandardWorkflowPrompt(
  promptDraft: ComfyPromptDraft,
): Promise<JsonRecord | null> {
  if (!shouldUseStandardWorkflow(promptDraft)) {
    return null;
  }

  const template = await loadStandardWorkflowTemplate();
  const cloned = JSON.parse(JSON.stringify(template)) as JsonRecord;

  // ← ASPECT RATIO → WIDTH/HEIGHT CONVERSION HAPPENS HERE
  const { width, height } = resolveResolution(
    promptDraft.parameters.aspectRatio,
    promptDraft.parameters.shortSidePx,
  );
  
  // For the workflow template, width = short side, height = long side (portrait default)
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  const loraConfig = promptDraft.loraConfig
    ? parseSectionLoraConfig(promptDraft.loraConfig)
    : { lora1: [], lora2: [] };

  const ksampler1 = parseKSamplerParams(promptDraft.ksampler1, DEFAULT_KSAMPLER1);
  const ksampler2 = parseKSamplerParams(promptDraft.ksampler2, DEFAULT_KSAMPLER2);

  const toBindings = (entries: Array<{ path: string; weight: number; enabled: boolean }>) =>
    entries.map((e) => ({ path: e.path, weight: e.weight, enabled: e.enabled }));

  const sectionSlug = promptDraft.metadata.sectionName?.replace(/\s+/g, "_") ?? "section";
  const sortOrder = promptDraft.metadata.sectionSortOrder ?? 0;

  const buildInput: WorkflowBuildInput = {
    workflowTemplate: cloned,
    positivePrompt: promptDraft.prompt.positive,
    negativePrompt: promptDraft.prompt.negative ?? "",
    shortSidePx: shortSide,      // ← PIXEL VALUES HERE
    longSidePx: longSide,        // ← PIXEL VALUES HERE
    batchSize: promptDraft.parameters.batchSize ?? 1,
    upscaleFactor: promptDraft.parameters.upscaleFactor ?? 2,
    lora1List: toBindings(loraConfig.lora1),
    lora2List: toBindings(loraConfig.lora2),
    ksampler1,
    ksampler2,
    outputPath: `${promptDraft.metadata.projectTitle}/${sortOrder}.${sectionSlug}`,
  };

  return buildWorkflowPrompt(buildInput);
}
```

**Key Conversion:**
- Line 465-468: `resolveResolution(aspectRatio, shortSidePx)` returns `{ width, height }`
- Line 470-471: Normalize to short/long sides
- Line 487-501: Pass to `buildWorkflowPrompt()` with pixel values

---

## 10. WORKFLOW PROMPT BUILDER - Filling the Template

### File: `/src/server/services/workflow-prompt-builder.ts`
**Lines: 137-200**

This is where the WIDTH and HEIGHT get injected into the actual ComfyUI JSON nodes:

#### buildWorkflowPrompt (Lines 137-200):
```typescript
export function buildWorkflowPrompt(input: WorkflowBuildInput): Record<string, unknown> {
  const wf = input.workflowTemplate;
  const upscale = input.upscaleFactor ?? 2;
  const skipHiresFix = upscale === 1;

  // 1. Prompts — nodes 511, 513
  nodeInputs(wf, "511").text = input.positivePrompt;
  nodeInputs(wf, "513").text = input.negativePrompt;

  // 2. Image dimensions — node 407 (Empty Latent Image)
  // ← ASPECT RATIO DIMENSIONS INJECTED HERE
  const latent = nodeInputs(wf, "407");
  latent.width = input.shortSidePx;            // ← FROM ASPECT RATIO
  latent.height = input.longSidePx;            // ← FROM ASPECT RATIO
  latent.batch_size = input.batchSize;

  if (skipHiresFix) {
    // 1x: bypass hires fix — remove Upscale Latent (425), KSampler2 (427),
    // and KS2 LoRA node (36). Rewire VAEDecode (410) to read from KS1 (3).
    delete (wf as Record<string, unknown>)["425"];
    delete (wf as Record<string, unknown>)["427"];
    delete (wf as Record<string, unknown>)["36"];
    nodeInputs(wf, "410").samples = ["3", 0];
  } else {
    // 3. Upscale dimensions — node 425 (Upscale Latent)
    const upscaleInputs = nodeInputs(wf, "425");
    upscaleInputs.width = input.shortSidePx * upscale;
    upscaleInputs.height = input.longSidePx * upscale;
  }

  // 4. LoRA 1 — node 522 (checkpoint → 522 → KS1)
  fillPowerLoraLoader(nodeInputs(wf, "522"), input.lora1List);

  // 5. LoRA 2 — node 36 (checkpoint → 36 → KS2, only when hires fix active)
  if (!skipHiresFix) {
    fillPowerLoraLoader(nodeInputs(wf, "36"), input.lora2List);
  }

  // 7. KSampler1 — node 3
  const ks1Defaults = DEFAULT_KSAMPLER1;
  const ks1 = nodeInputs(wf, "3");
  ks1.steps = input.ksampler1.steps ?? ks1Defaults.steps;
  ks1.cfg = input.ksampler1.cfg ?? ks1Defaults.cfg;
  ks1.sampler_name = input.ksampler1.sampler_name ?? ks1Defaults.sampler_name;
  ks1.scheduler = input.ksampler1.scheduler ?? ks1Defaults.scheduler;
  ks1.denoise = input.ksampler1.denoise ?? ks1Defaults.denoise;
  ks1.seed = resolveSeed(input.ksampler1);

  // 8. KSampler2 — node 427 (only when hires fix is active)
  if (!skipHiresFix) {
    const ks2Defaults = DEFAULT_KSAMPLER2;
    const ks2 = nodeInputs(wf, "427");
    ks2.steps = input.ksampler2.steps ?? ks2Defaults.steps;
    ks2.cfg = input.ksampler2.cfg ?? ks2Defaults.cfg;
    ks2.sampler_name = input.ksampler2.sampler_name ?? ks2Defaults.sampler_name;
    ks2.scheduler = input.ksampler2.scheduler ?? ks2Defaults.scheduler;
    ks2.denoise = input.ksampler2.denoise ?? ks2Defaults.denoise;
    ks2.seed = resolveSeed(input.ksampler2);
  }

  // 9. Output path — node 515 (Image Save)
  nodeInputs(wf, "515").output_path = input.outputPath;

  return wf;
}
```

**Critical Lines for AspectRatio:**
- **Line 147-150**: Node 407 (Empty Latent Image) gets width/height from aspectRatio conversion
- **Line 161-163**: Node 425 (Upscale Latent) gets upscaled dimensions when hires fix is active

---

## 11. WORKFLOW TEMPLATE NODE IDS

### File: `/docs/workflow.api.json`

The standard workflow template contains these key nodes:

```json
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "..." }
  },
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 49599188716761,
      "steps": 30,
      "cfg": 4,
      "model": ["522", 0],
      "positive": ["4", 0],
      "negative": ["12", 0],
      "latent_image": ["407", 0]
    }
  },
  "407": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 512,    // ← ASPECT RATIO INJECTED HERE
      "height": 768,   // ← ASPECT RATIO INJECTED HERE
      "batch_size": 1
    }
  },
  "425": {
    "class_type": "LatentUpscale",
    "inputs": {
      "upscale_method": "bilinear",
      "width": 1024,   // ← UPSCALED WIDTH (width * upscaleFactor)
      "height": 1536,  // ← UPSCALED HEIGHT (height * upscaleFactor)
      "crop": "disabled",
      "samples": ["3", 0]
    }
  },
  "427": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 736463954525772,
      "steps": 30,
      "cfg": 7,
      "model": ["36", 0],
      "positive": ["519", 0],
      "negative": ["520", 0],
      "latent_image": ["425", 0]
    }
  },
  "511": {
    "class_type": "Text Multiline",
    "inputs": { "text": "" }  // ← POSITIVE PROMPT INJECTED
  },
  "513": {
    "class_type": "Text Multiline",
    "inputs": { "text": "" }  // ← NEGATIVE PROMPT INJECTED
  },
  "515": {
    "class_type": "Image Save",
    "inputs": {
      "output_path": "",
      "filename_prefix": "",
      ...
      "images": ["410", 0]
    }
  },
  "522": {
    "class_type": "Power Lora Loader (rgthree)",
    "inputs": {
      "model": ["1", 0],
      "clip": ["1", 1]
    }
  }
}
```

---

## 12. COMFYUI SUBMISSION

### File: `/src/server/services/comfyui-service.ts`
**Lines: 564-598**

```typescript
export async function submitComfyPrompt(
  validatedDraft: ValidatedComfyPromptDraft,
  promptDraft: ComfyPromptDraft,
) {
  const payload = await fetchJson(
    `${validatedDraft.apiUrl}/prompt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: validatedDraft.apiPrompt,  // ← FILLED WORKFLOW JSON
        client_id: promptDraft.clientId,
        extra_data: validatedDraft.extraData,
      }),
    },
    "ComfyUI prompt submit",
  );
  const response = asRecord(payload);
  const promptId = typeof response?.prompt_id === "string" ? response.prompt_id : null;
  const nodeErrors = asRecord(response?.node_errors);

  if (nodeErrors && Object.keys(nodeErrors).length > 0) {
    throw new Error(`ComfyUI prompt submit returned node_errors: ${formatUnknownValue(nodeErrors)}`);
  }

  if (!promptId) {
    throw new Error("ComfyUI prompt submit did not return prompt_id");
  }

  return promptId;
}
```

The `validatedDraft.apiPrompt` contains the fully resolved workflow JSON with all aspectRatio dimensions injected into the node inputs.

---

## COMPLETE FLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER SETS ASPECT RATIO IN UI                             │
│    section-edit-form.tsx (Lines 87-104)                     │
│    Selects from: 1:1, 2:3, 3:4, 9:16, 3:2, 4:3, 16:9       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SAVED TO DATABASE                                        │
│    ProjectSection.aspectRatio (prisma/schema.prisma:181)   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. QUEUED RUN READS ASPECT RATIO                            │
│    buildResolvedConfigSnapshot()                            │
│    (src/server/repositories/project-repository.ts:273-351)  │
│    → parameters.aspectRatio                                 │
│    → stored in Run.resolvedConfigSnapshot                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. BUILD COMFY PROMPT DRAFT                                 │
│    buildComfyPromptDraft()                                  │
│    (src/server/worker/payload-builder.ts:103-132)           │
│    → ComfyPromptDraft.parameters.aspectRatio                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. RESOLVE ASPECT RATIO → WIDTH/HEIGHT                      │
│    resolveResolution(aspectRatio, shortSidePx)              │
│    (src/lib/aspect-ratio-utils.ts:42-68)                    │
│    Output: { width: number, height: number }                │
│                                                              │
│    MAPPING:                                                 │
│    "1:1"  → {width: 1024, height: 1024}                    │
│    "2:3"  → {width: 832,  height: 1216}                    │
│    "3:4"  → {width: 896,  height: 1152}                    │
│    "9:16" → {width: 768,  height: 1344}                    │
│    "3:2"  → {width: 1216, height: 832}                     │
│    "4:3"  → {width: 1152, height: 896}                     │
│    "16:9" → {width: 1344, height: 768}                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. INJECT INTO WORKFLOW TEMPLATE                            │
│    buildWorkflowPrompt()                                    │
│    (src/server/services/workflow-prompt-builder.ts:137-200) │
│                                                              │
│    Node 407 (EmptyLatentImage):                            │
│      inputs.width = shortSidePx                             │
│      inputs.height = longSidePx                             │
│      inputs.batch_size = batchSize                          │
│                                                              │
│    Node 425 (LatentUpscale):                               │
│      inputs.width = shortSidePx * upscaleFactor             │
│      inputs.height = longSidePx * upscaleFactor             │
│                                                              │
│    Node 511 (Positive Prompt Text):                        │
│      inputs.text = positivePrompt                           │
│                                                              │
│    Node 513 (Negative Prompt Text):                        │
│      inputs.text = negativePrompt                           │
│                                                              │
│    Nodes 3, 427 (KSampler):                                │
│      seeds, steps, cfg, sampler_name, scheduler, denoise   │
│                                                              │
│    Node 515 (Image Save):                                  │
│      inputs.output_path = outputPath                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. SUBMIT TO COMFYUI                                        │
│    POST /prompt                                             │
│    (src/server/services/comfyui-service.ts:564-598)         │
│    → Sends fully filled workflow JSON                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. COMFYUI EXECUTION                                        │
│    Reads node 407 (width, height) for latent generation     │
│    Processes through KSampler with those dimensions         │
└─────────────────────────────────────────────────────────────┘
```

---

## KEY FILES INVOLVED

| File | Line(s) | Role |
|------|---------|------|
| `prisma/schema.prisma` | 181 | Storage: `ProjectSection.aspectRatio` |
| `src/app/projects/.../section-edit-form.tsx` | 87-104 | UI: Select aspect ratio |
| `src/lib/aspect-ratio-utils.ts` | 12-87 | Define aspect ratios & resolve to dimensions |
| `src/server/repositories/project-repository.ts` | 273-351 | Build resolvedConfigSnapshot with aspectRatio |
| `src/server/worker/payload-builder.ts` | 103-132 | Build ComfyPromptDraft from snapshot |
| `src/server/services/comfyui-service.ts` | 454-504 | Convert aspectRatio to width/height via resolveResolution |
| `src/server/services/workflow-prompt-builder.ts` | 137-200 | Inject width/height into workflow JSON nodes |
| `docs/workflow.api.json` | Various | ComfyUI workflow template with node IDs |

---

## EXAMPLE END-TO-END TRACE

**Example: User selects "3:4" aspect ratio with 896px short side**

1. **User Input**: Selects `aspectRatio="3:4"` in section edit form
2. **DB Storage**: `ProjectSection.aspectRatio = "3:4"`
3. **Queue Creation**: `buildResolvedConfigSnapshot` reads it → `parameters.aspectRatio = "3:4"`
4. **Draft Building**: `buildComfyPromptDraft` → `ComfyPromptDraft.parameters.aspectRatio = "3:4"`
5. **Resolution**: `resolveResolution("3:4", null)` → returns `{ width: 896, height: 1152 }`
6. **Workflow Building**:
   - Node 407 (EmptyLatentImage) gets: `width: 896, height: 1152`
   - Node 425 (Upscale) gets: `width: 1792 (896*2), height: 2304 (1152*2)` (if upscaleFactor=2)
7. **Submit**: Final JSON sent to ComfyUI with these exact dimensions

