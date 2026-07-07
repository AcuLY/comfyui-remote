# ComfyUI Remote Codebase Analysis

Classification: architecture reference
Current source: use `docs/index.md` first; current workflow contract lives in `docs/workflow.api.json`, worker boundaries live in `docs/worker-boundaries.md`, and implementation ownership lives in `docs/repo-inventory.md`.

## Executive Summary

The system processes image generation workflows through a three-stage pipeline:
1. **Draft Building** → Normalize run config to ComfyPromptDraft
2. **Prompt Validation** → Convert draft to ComfyUI API prompt JSON
3. **Execution & Persistence** → Submit to ComfyUI, download results, store locally

**Key finding**: **NO image upload to ComfyUI input directory exists.** The system is txt2img/img2img generation only. **NO post-processing/secondary generation system exists** either.

---

## Question 1: Image Upload Functionality

### Status: ❌ NOT IMPLEMENTED

**Search Results:**
- Grep for "upload/image", "/upload", "input" → No relevant hits in comfyui-service.ts
- ComfyUI API interaction is **download-only** (via `/view` endpoint)
- No code for uploading to ComfyUI's `/upload` API endpoint

**Evidence:**
```typescript
// From image-result-service.ts:165-212
// ONLY downloads FROM ComfyUI via /view endpoint
async function downloadOutputImageBuffer(
  apiUrl: string,
  outputImage: ComfyPromptOutputImage,
): Promise<Buffer> {
  const searchParams = new URLSearchParams({
    filename: outputImage.filename,
    subfolder: normalizeSubfolder(outputImage.subfolder),
    type: outputImage.type,
  });
  const response = await fetch(
    `${normalizeApiUrl(apiUrl)}/view?${searchParams.toString()}`,
    { method: "GET", /* ... */ }
  );
  // ... no upload logic
}
```

**API Routes Scanned:**
- `/src/app/api/` has 150+ routes
- No upload endpoints for images to ComfyUI
- Image routes (`/api/images/`) are READ/FEATURED/TRASH operations only

---

## Question 2: Workflow JSON → API Prompt Conversion

### Architecture: **Priority-Based Three-Stage System**

#### Stage 1: Validate Draft
**File:** `/src/server/services/comfyui-service.ts:479-526`

```typescript
export async function validateComfyPromptDraft(
  apiUrl: string,
  promptDraft: ComfyPromptDraft,
): Promise<ValidatedComfyPromptDraft> {
  // Priority 1: Check for explicit custom API prompt in extraParams
  const customApiPrompt = extractJsonRecordByKeys(extraParams, [
    "comfyPrompt",
    "workflowApiPrompt", 
    "apiPrompt",
  ]);

  let apiPrompt: JsonRecord;

  if (customApiPrompt && Object.keys(customApiPrompt).length > 0) {
    // Use custom prompt if provided
    apiPrompt = customApiPrompt;
  } else {
    // Priority 2: Try standard workflow.api.json
    const standardPrompt = await resolveStandardWorkflowPrompt(promptDraft);
    // Priority 3: Fall back to built-in SDXL txt2img
    apiPrompt = standardPrompt ?? buildFallbackPromptNodes(promptDraft);
  }

  return {
    apiUrl: normalizeApiUrl(apiUrl),
    apiPrompt,
    extraData: { /* structured metadata */ },
  };
}
```

#### Stage 2: Template Resolution (Standard Workflow)
**File:** `/src/server/services/comfyui-service.ts:428-477`

```typescript
async function resolveStandardWorkflowPrompt(
  promptDraft: ComfyPromptDraft,
): Promise<JsonRecord | null> {
  const template = await loadStandardWorkflowTemplate();
  // Deep-clone template (CRITICAL: prevents mutation)
  const cloned = JSON.parse(JSON.stringify(template)) as JsonRecord;

  const { width, height } = resolveResolution(
    promptDraft.parameters.aspectRatio,
    promptDraft.parameters.shortSidePx,
  );
  
  const loraConfig = promptDraft.loraConfig
    ? parseSectionLoraConfig(promptDraft.loraConfig)
    : { lora1: [], lora2: [] };

  const buildInput: WorkflowBuildInput = {
    workflowTemplate: cloned,
    positivePrompt: promptDraft.prompt.positive,
    negativePrompt: promptDraft.prompt.negative ?? "",
    width, height,
    batchSize: promptDraft.parameters.batchSize ?? 1,
    upscaleFactor: promptDraft.parameters.upscaleFactor ?? 2,
    checkpointName: promptDraft.checkpointName ?? null,
    lora1List: toBindings(loraConfig.lora1),
    lora2List: toBindings(loraConfig.lora2),
    ksampler1, ksampler2,
    outputPath: `${projectTitle}/${sortOrder}.${sectionSlug}`,
    runId: promptDraft.metadata.runId,
  };

  return buildWorkflowPrompt(buildInput);
}
```

#### Stage 3: Template Filling (Workflow Prompt Builder)
**File:** `/src/server/services/workflow-prompt-builder.ts:30-213`

**Input Type:**
```typescript
export type WorkflowBuildInput = {
  workflowTemplate: Record<string, unknown>;  // docs/workflow.api.json
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  batchSize: number;
  upscaleFactor?: number;
  checkpointName?: string | null;
  lora1List: LoraBinding[];  // [{path, weight, enabled}]
  lora2List: LoraBinding[];
  ksampler1: KSamplerParams;
  ksampler2: KSamplerParams;
  outputPath: string;       // e.g. "MyProject/1.section_name"
  runId?: string;
};
```

**Node Mapping from `docs/workflow.api.json`:**

| Node ID | Class Type | Purpose | Mutable Fields |
|---------|-----------|---------|---|
| 1 | CheckpointLoaderSimple | Model loader | `inputs.ckpt_name` |
| 3 | KSampler | Stage 1 generation | `seed`, `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise` |
| 407 | EmptyLatentImage | Latent init | `width`, `height`, `batch_size` |
| 425 | LatentUpscale | HiresFix upscale | `width`, `height` (skipped if `upscaleFactor=1`) |
| 427 | KSampler | Stage 2 (HiresFix) | Same as node 3 (skipped if `upscaleFactor=1`) |
| 511 | Text Multiline | Positive prompt | `inputs.text` |
| 513 | Text Multiline | Negative prompt | `inputs.text` |
| 522 | Power Lora Loader | LoRA stage 1 | `lora_1`, `lora_2`, ... (dynamic) |
| 36 | Power Lora Loader | LoRA stage 2 | `lora_1`, `lora_2`, ... (skipped if `upscaleFactor=1`) |
| 515 | Image Save | Output | `output_path`, `filename_prefix` |

**Key Implementation Detail - LoRA Filling:**
```typescript
function fillPowerLoraLoader(inputs: JsonRecord, bindings: LoraBinding[]): void {
  // Clear existing lora_N entries
  for (const key of Object.keys(inputs)) {
    if (/^lora_\d+$/.test(key)) delete inputs[key];
  }
  
  // Fill with new entries
  const enabledBindings = bindings.filter((b) => b.enabled);
  for (let i = 0; i < enabledBindings.length; i++) {
    inputs[`lora_${i + 1}`] = {
      on: true,
      lora: bindings[i].path.replace(/\\/g, "/"),
      strength: bindings[i].weight,
    };
  }
}
```

---

## Question 3: Prisma Schema - ImageResult Fields

**File:** `/prisma/schema.prisma:456-475`

```typescript
model ImageResult {
  id                    String          @id @default(cuid())
  runId                 String
  filePath              String          @unique
  thumbPath             String?
  width                 Int?
  height                Int?
  fileSize              BigInt?
  reviewStatus          ReviewStatus    @default(pending)
  featured              Boolean         @default(false)
  featured2             Boolean         @default(false)
  reviewedAt            DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  run                   Run             @relation(fields: [runId], references: [id], onDelete: Cascade)
  trashRecord           TrashRecord?

  @@index([reviewStatus, createdAt])
  @@index([runId, createdAt])
}

enum ReviewStatus {
  pending
  kept
  trashed
}
```

**All Fields Summary:**
1. `id` (String, @id) — Unique identifier (CUID)
2. `runId` (String, FK) — Parent Run reference
3. `filePath` (String, @unique) — Relative path to image file
4. `thumbPath` (String?, nullable) — Relative path to thumbnail
5. `width` (Int?, nullable) — Image width in pixels
6. `height` (Int?, nullable) — Image height in pixels
7. `fileSize` (BigInt?, nullable) — File size in bytes
8. `reviewStatus` (ReviewStatus enum) — {pending|kept|trashed}
9. `featured` (Boolean) — Primary featured flag
10. `featured2` (Boolean) — Secondary featured flag
11. `reviewedAt` (DateTime?, nullable) — Timestamp of review action
12. `createdAt` (DateTime) — Creation timestamp
13. `updatedAt` (DateTime) — Last update timestamp
14. `run` (Relation) — Reference to parent Run
15. `trashRecord` (Relation?) — Optional trash metadata

---

## Question 4: Managed Image Directory Structure

**File:** `/src/server/services/image-result-service.ts:117-133`

**Path Generation Function:**
```typescript
function resolveManagedRunOutputPaths(run: WorkerRunSnapshot): ManagedRunOutputPaths {
  const projectSegment = sanitizePathSegment(run.project.slug, run.project.id);
  const sectionSegment = sanitizePathSegment(run.section.slug, run.section.id);
  const runIdSegment = sanitizePathSegment(run.runId, "run");
  const runSegment = `run-${String(run.runIndex).padStart(2, "0")}-${runIdSegment}`;
  
  const absoluteRunDir = resolve(process.cwd(), "data", "images", projectSegment, sectionSegment, runSegment);
  const absoluteOutputDir = join(absoluteRunDir, "raw");
  const absoluteThumbDir = join(absoluteRunDir, "thumb");

  return {
    absoluteRunDir,           // data/images/{project}/{section}/run-{N}-{runId}
    absoluteOutputDir,        // data/images/{project}/{section}/run-{N}-{runId}/raw
    absoluteThumbDir,         // data/images/{project}/{section}/run-{N}-{runId}/thumb
    relativeOutputDir,        // For DB storage
    relativeThumbDir,         // For DB storage
  };
}
```

**Directory Structure:**
```
data/images/
├── {project-slug-or-id}/
│   └── {section-slug-or-id}/
│       └── run-{pad-2:runIndex}-{sanitized-runId}/
│           ├── raw/
│           │   ├── 01.jpg  (image 1)
│           │   ├── 02.jpg  (image 2)
│           │   └── ...
│           └── thumb/
│               ├── 01.jpg  (thumbnail 1)
│               ├── 02.jpg  (thumbnail 2)
│               └── ...
```

**File Naming:**
- Raw images: `{1-padded}.jpg` (e.g., `01.jpg`, `02.jpg`)
- Thumbnails: Same name in separate `thumb/` directory
- Format: Always JPEG (converted from ComfyUI output via sharp)
- Thumbnail: Max 400px dimension, 80% quality

**Persistence Function:**
```typescript
export async function persistComfyOutputImages(
  run: WorkerRunSnapshot,
  apiUrl: string,
  outputImages: ComfyPromptOutputImage[],
): Promise<PersistedRunOutput> {
  // 1. Downloads from ComfyUI via /view endpoint
  // 2. Converts to JPEG (sharp.rotate().jpeg({quality:90}))
  // 3. Atomically writes to managed paths
  // 4. Creates thumbnails (sharp.resize() in thumb/)
  // 5. Cleans up stale files from previous runs
  // 6. Returns array of {filePath, thumbPath, width, height, fileSize}
}
```

---

## Question 5: Post-Processing System

### Status: ❌ NOT IMPLEMENTED

**Search Results:**
- Grep for "post.process", "reprocess", "refine", "secondary" → No hits
- No code for img2img workflows or secondary generation
- Training v2 has image *review* for dataset curation but not end-user generation from an existing image

**System Patterns:**
1. All generation starts from `EmptyLatentImage` (txt2img)
2. No `LoadImage` nodes in standard workflow
3. No img2img KSampler (denoise < 1.0 for input image)
4. Image review (keep/trash) is for QA only, not for re-generation

**Related Models (Training v2):**
```typescript
// From schema.prisma (training, NOT main generation)
model TrainingGenerationTask {
  sectionRuns TrainingSectionRun[]
}

model TrainingSectionRun {
  generationTaskId String?
  generationTask   TrainingGenerationTask? @relation(...)

  // This is for training dataset curation
  // NOT for end-user post-processing workflows
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DRAFT BUILDING                                               │
│    ProjectSection config → normalizeResolvedConfigSnapshot()    │
│                         → buildComfyPromptDraft()               │
└─────────────────────────────────────────────────────────────────┘
                                ↓
          ComfyPromptDraft {
            clientId, workflowId,
            prompt: {positive, negative},
            parameters: {aspectRatio, shortSidePx, batchSize, ...},
            checkpointName,
            ksampler1/2,
            loraConfig: {lora1[], lora2[]},
            extraParams,
            metadata: {runId, runIndex, projectId, ...}
          }
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. PROMPT VALIDATION                                            │
│    validateComfyPromptDraft(apiUrl, promptDraft)                │
│                                                                  │
│    Priority 1: Custom API prompt in extraParams?                │
│      ↓ if not:                                                  │
│    Priority 2: resolveStandardWorkflowPrompt()                  │
│      ↓ if not:                                                  │
│    Priority 3: buildFallbackPromptNodes()                       │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. STANDARD WORKFLOW RESOLUTION (Most Common Path)              │
│    docs/workflow.api.json (deep-cloned)                         │
│           ↓                                                     │
│    buildWorkflowPrompt(WorkflowBuildInput)                      │
│      • Fill node 511 (positive prompt)                          │
│      • Fill node 513 (negative prompt)                          │
│      • Fill node 407 (width/height/batch)                       │
│      • Fill node 522, 36 (LoRAs)                                │
│      • Fill node 3, 427 (KSampler seeds/steps/cfg)              │
│      • Fill node 515 (output_path, filename_prefix)             │
│           ↓                                                     │
│    Return: ComfyUI API prompt JSON                              │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SUBMISSION & EXECUTION                                       │
│    POST /prompt → ComfyUI returns prompt_id                     │
│         ↓                                                       │
│    Poll GET /history/{prompt_id}                                │
│         ↓                                                       │
│    Extract outputImages[] from history response                 │
│    Extract executionMeta (seeds, params) from apiPrompt         │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. PERSISTENCE                                                  │
│    persistComfyOutputImages()                                   │
│      • Download each image via GET /view?filename=...           │
│      • Convert to JPEG (sharp)                                  │
│      • Store in data/images/{proj}/{sect}/run-{N}-{id}/raw/     │
│      • Create thumbnails in thumb/                              │
│      • Store metadata in ImageResult table                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Reuse Patterns

### 1. Prompt Composition
**Pattern:** Concatenate multiple prompt sources with " BREAK " separator

```typescript
// From payload-builder.ts:36-43
function composePositivePrompt(snapshot: NormalizedResolvedConfigSnapshot) {
  return [
    snapshot.section.templatePrompt,
    snapshot.section.positivePrompt,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" BREAK ");  // Magic separator for multi-block prompts
}
```

### 2. JSON Record Casting
**Pattern:** Safe casting with null checks

```typescript
// From comfyui-service.ts:76-82
function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

// From comfyui-service.ts:84-90
function asJsonRecord(value: Prisma.JsonValue | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}
```

### 3. Node Template Mutation
**Pattern:** Ensure node exists, then mutate inputs

```typescript
function nodeInputs(template: JsonRecord, nodeId: string): JsonRecord {
  let node = template[nodeId] as JsonRecord | undefined;
  if (!node) {
    node = { inputs: {} };
    template[nodeId] = node;
  }
  let inputs = node.inputs as JsonRecord | undefined;
  if (!inputs) {
    inputs = {};
    node.inputs = inputs;
  }
  return inputs;
}

// Usage:
nodeInputs(wf, "511").text = input.positivePrompt;
nodeInputs(wf, "407").width = input.width;
```

### 4. Atomic File Writing (Windows-Safe)
**Pattern:** Write to temp file, delete target, then rename

```typescript
async function atomicWriteFile(targetPath: string, data: Buffer) {
  const tempPath = `${targetPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, data);

  try {
    await retryOnEBUSY(() => unlink(targetPath));
  } catch (error) {
    if (!(error as NodeJS.ErrnoException)?.code === "ENOENT") throw error;
  }

  try {
    await retryOnEBUSY(() => rename(tempPath, targetPath));
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}
```

### 5. EBUSY Retry Pattern (Windows Lock Handling)
```typescript
async function retryOnEBUSY<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 200,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isEBUSY(error) || attempt === maxRetries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

### 6. Path Sanitization
```typescript
function sanitizePathSegment(value: string, fallback: string) {
  const sanitizedValue = value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")  // Unicode-aware
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitizedValue || fallback;
}
```

---

## Function Signatures for Reuse

### Prompt Building
```typescript
// payload-builder.ts
export function buildComfyPromptDraft(run: WorkerRunSnapshot): ComfyPromptDraft

// comfyui-service.ts
export async function validateComfyPromptDraft(
  apiUrl: string,
  promptDraft: ComfyPromptDraft,
): Promise<ValidatedComfyPromptDraft>

// workflow-prompt-builder.ts
export function buildWorkflowPrompt(input: WorkflowBuildInput): Record<string, unknown>
```

### Execution & Persistence
```typescript
// comfyui-service.ts
export async function executeComfyPromptDraft(
  apiUrl: string,
  promptDraft: ComfyPromptDraft,
): Promise<ComfyPromptExecutionResult>

export function extractExecutionMeta(
  apiPrompt: JsonRecord,
  promptDraft?: ComfyPromptDraft,
): Record<string, unknown>

export function extractOutputImages(entry: ComfyPromptHistoryEntry): ComfyPromptOutputImage[]

// image-result-service.ts
export async function persistComfyOutputImages(
  run: WorkerRunSnapshot,
  apiUrl: string,
  outputImages: ComfyPromptOutputImage[],
): Promise<PersistedRunOutput>
```

### Metadata Normalization
```typescript
// payload-builder.ts
export function normalizeResolvedConfigSnapshot(
  snapshot: WorkerRunSnapshot["resolvedConfigSnapshot"],
): NormalizedResolvedConfigSnapshot
```

---

## Types for Reference

```typescript
// From comfyui-service.ts:28-40
export type ComfyPromptOutputImage = {
  filename: string;
  subfolder: string;
  type: string;
};

export type ComfyPromptExecutionResult = {
  comfyPromptId: string;
  outputDir: string | null;
  outputImages: ComfyPromptOutputImage[];
  executionMeta: Record<string, unknown> | null;
};

// From image-result-service.ts:11-22
export type PersistedRunOutputImage = {
  filePath: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  fileSize: bigint | null;
};

export type PersistedRunOutput = {
  outputDir: string;
  images: PersistedRunOutputImage[];
};
```

---

## Key Constraints & Considerations

1. **Template Deep-Clone Required:** `buildWorkflowPrompt()` mutates the template in-place. Caller must deep-clone beforehand to avoid state pollution across runs.

2. **Windows File Locking:** Path persistence uses atomic writes + EBUSY retry pattern to handle Windows file locks from concurrent image serving.

3. **Output Path Normalization:** Always use Unix-style separators (`/`) in `outputPath` to prevent `[Errno 22]` on Windows.

4. **LoRA Path Format:** Convert backslashes to forward slashes in LoRA paths: `bindings[i].path.replace(/\\/g, "/")`

5. **Seed Range:** ComfyUI seeds must fit in 32-bit unsigned range (0 to 4,294,967,295).

6. **HiresFix Skip:** When `upscaleFactor === 1`, nodes 425 (LatentUpscale), 427 (KSampler2), and 36 (LoRA2) are deleted from the workflow.

7. **Image Format:** Always JPEG with quality 90 for storage, thumbnails quality 80.

8. **Thumbnail Dimensions:** 400px max on longest side, PNG format for thumbnails in separate directory.

9. **Atomic Directory Pattern:**
   ```
   data/images/{projectSlug|projectId}/{sectionSlug|sectionId}/run-{pad:N}-{sanitized_runId}/{raw|thumb}/
   ```

---

## Missing Features for Image Input/Post-Processing

**To add img2img or image transformation support, you would need:**

1. **Image Upload Service:**
   - POST endpoint to accept image file
   - Validate and store in ComfyUI input directory or managed path
   - Return file reference (filename/path)

2. **LoadImage Node Addition:**
   - Extend workflow template with `LoadImage` node
   - Add to `WorkflowBuildInput` type (optional `inputImagePath`)
   - Insert node into graph and wire to KSampler's `latent_image` input

3. **Denoise Control:**
   - Add `denoise` field (0-1) to KSampler inputs
   - Default 1.0 (txt2img), lower for img2img (typically 0.3-0.8)

4. **Post-Processing Workflow:**
   - Define "secondary" project template or run type
   - Link to previous Run's output images
   - Apply transformation (upscale, color correct, style transfer)
   - Store results separately or as run chain

5. **Execution Chain:**
   - Track run dependencies (Run.parentRunId reference)
   - Validate input image exists before submission
   - Aggregate results from chain
