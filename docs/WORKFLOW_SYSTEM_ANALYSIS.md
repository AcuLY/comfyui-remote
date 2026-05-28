# ComfyUI Image Generation System - Workflow & Data Storage Analysis

## Executive Summary

This ComfyUI remote management system uses a sophisticated multi-layer approach to manage image generation workflows:

1. **Workflow Templates**: Stored as JSON files (`docs/workflow.api.json`), defining the ComfyUI node graph structure
2. **Workflow Parameterization**: Built dynamically through a builder pattern that fills template nodes with section-specific parameters
3. **Prompt Submission**: Structured API payloads sent to ComfyUI's `/prompt` endpoint containing the full workflow graph
4. **Run Tracking**: Complete workflow state and execution metadata stored in PostgreSQL database with JSON columns

---

## 1. WORKFLOW STORAGE & TEMPLATES

### 1.1 Standard Workflow Template Location
**File**: `docs/workflow.api.json` (263 lines)

**Purpose**: Master template defining the ComfyUI node graph structure with:
- Checkpoint loading (node 1)
- Positive/negative prompt encoding (nodes 511, 513, 4, 12)
- Two-stage image generation pipeline:
  - **Stage 1 (KSampler1)**: Initial generation with node 3
  - **Stage 2 (KSampler2)**: High-res refinement (hires fix) with node 427
- LoRA application nodes (node 522 for stage 1, node 36 for stage 2)
- Upscaling (node 425)
- Output saving (node 515)

### 1.2 Template Structure
```json
{
  "1": {
    "inputs": { "ckpt_name": "oneObsession_v19Atypical.safetensors" },
    "class_type": "CheckpointLoaderSimple"
  },
  "3": {
    "inputs": {
      "seed": 49599188716761,
      "steps": 30,
      "cfg": 4,
      "sampler_name": "euler_ancestral",
      "scheduler": "karras",
      "denoise": 1,
      "model": ["522", 0],
      "positive": ["4", 0],
      "negative": ["12", 0],
      "latent_image": ["407", 0]
    },
    "class_type": "KSampler"
  },
  // ... more nodes ...
}
```

### 1.3 Template Loading & Caching
- **Location**: `src/server/services/comfyui-service.ts` → `loadStandardWorkflowTemplate()`
- **Behavior**: 
  - Cached in memory after first load: `cachedStandardWorkflow`
  - Read once from disk: `process.cwd() + "/docs/workflow.api.json"`
  - Deep-cloned for each run to prevent mutations
  - Fallback builder available if template is missing

---

## 2. WORKFLOW PROMPT BUILDING

### 2.1 Prompt Builder Pipeline
**Core File**: `src/server/services/workflow-prompt-builder.ts`

**Function**: `buildWorkflowPrompt(input: WorkflowBuildInput): Record<string, unknown>`

Fills workflow template nodes with section-specific parameters:

```typescript
type WorkflowBuildInput = {
  workflowTemplate: Record<string, unknown>;  // Cloned template
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  batchSize: number;
  upscaleFactor?: number;                     // 1/1.5/2/2.5/3, default 2
  checkpointName?: string | null;
  lora1List: LoraBinding[];                   // Stage 1 LoRAs
  lora2List: LoraBinding[];                   // Stage 2 LoRAs
  ksampler1: KSamplerParams;                  // Steps, CFG, sampler, etc.
  ksampler2: KSamplerParams;                  // Hires fix params
  outputPath: string;                         // "ProjectTitle/1.section_name"
  runId?: string;                             // Unique filename_prefix
};
```

### 2.2 Node Filling Operations

| Node | Parameter | Purpose |
|------|-----------|---------|
| 1 | `ckpt_name` | Checkpoint model selection |
| 3, 427 | `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise`, `seed` | KSampler configuration |
| 511, 513 | `text` | Positive/negative prompts |
| 407 | `width`, `height`, `batch_size` | Image dimensions |
| 425 | `width`, `height` | Upscale target (rounded to multiple of 8) |
| 522, 36 | `lora_N` entries | LoRA bindings with `{on, lora, strength}` |
| 515 | `output_path`, `filename_prefix` | Output directory and run ID |

### 2.3 Special Logic

**Hires Fix Handling**:
- `upscaleFactor === 1`: Bypass hires fix
  - Deletes nodes 425 (Upscale), 427 (KSampler2), 36 (LoRA2)
  - Rewires node 410 (VAEDecode) to read from KSampler1
- `upscaleFactor > 1`: Full two-stage pipeline
  - Calculate upscale dimensions: `Math.round((width * upscale) / 8) * 8`

**Seed Resolution**:
- `seedPolicy === "fixed"`: Use 42
- `seedPolicy === "increment"`: Falls back to random (ComfyUI doesn't track across runs)
- `seedPolicy === "random"`: `Math.floor(Math.random() * 4294967295)`

**LoRA Processing**:
```typescript
// From LoraBinding[] to Power Lora Loader input
{
  lora_1: { on: true, lora: "category/file.safetensors", strength: 0.8 },
  lora_2: { on: true, lora: "category/file.safetensors", strength: 0.9 }
}
```

---

## 3. PROMPT DRAFT CONSTRUCTION

### 3.1 Payload Builder
**File**: `src/server/worker/payload-builder.ts`

**Function**: `buildComfyPromptDraft(run: WorkerRunSnapshot): ComfyPromptDraft`

Transforms database-stored config snapshot into submission-ready draft:

```typescript
type ComfyPromptDraft = {
  clientId: string;                           // "run-{runId}"
  workflowId: string;                         // Project slug
  prompt: {
    positive: string;                         // Composed from blocks
    negative: string | null;
  };
  parameters: {
    aspectRatio: string | null;               // "9:16", "1:1", etc.
    shortSidePx: number | null;               // 512, 768, etc.
    batchSize: number | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    upscaleFactor: number | null;
    checkpointName: string | null;
  };
  checkpointName: string | null;
  ksampler1: Prisma.JsonObject | null;        // Full KSampler params
  ksampler2: Prisma.JsonObject | null;        // Hires fix params
  loraConfig: Prisma.JsonObject | null;       // {lora1: [], lora2: []}
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

### 3.2 Prompt Composition
Positive prompt built from:
1. Section template prompt (if exists)
2. Section positive prompt
3. Joined with " BREAK " separator

```typescript
composePositivePrompt(snapshot: NormalizedResolvedConfigSnapshot): string
  = [snapshot.section.templatePrompt, snapshot.section.positivePrompt]
    .filter(v => v?.trim())
    .join(" BREAK ")
```

---

## 4. PROMPT VALIDATION & SUBMISSION

### 4.1 Validation Pipeline
**File**: `src/server/services/comfyui-service.ts`

**Function**: `validateComfyPromptDraft(apiUrl, promptDraft) → ValidatedComfyPromptDraft`

Priority order for API prompt resolution:
1. **Custom comfyPrompt** in `extraParams.comfyPrompt` (explicit override)
2. **Standard workflow.api.json** via `resolveStandardWorkflowPrompt()` (default)
3. **Fallback SDXL builder** via `buildFallbackPromptNodes()` (emergency)

### 4.2 Validated Draft Structure
```typescript
type ValidatedComfyPromptDraft = {
  apiUrl: string;                             // Normalized ComfyUI API URL
  apiPrompt: JsonRecord;                      // Full workflow node graph
  extraData: JsonRecord;                      // Metadata for ComfyUI
};
```

Extra data includes:
```json
{
  "comfyuiRemote": {
    "workflowId": "project-slug",
    "prompt": { "positive": "...", "negative": "..." },
    "parameters": { /* ... */ },
    "loraConfig": { "lora1": [], "lora2": [] },
    "metadata": { "runId", "projectId", "sectionId", /* ... */ }
  }
}
```

### 4.3 ComfyUI API Submission
**Function**: `submitComfyPrompt(validatedDraft, promptDraft, options?)`

**Request**:
```
POST http://COMFY_API_URL/prompt
Content-Type: application/json

{
  "prompt": { /* full node graph */ },
  "client_id": "run-{runId}",
  "extra_data": { /* metadata */ },
  "front": true  // optional: prioritize in queue
}
```

**Response**:
```json
{
  "prompt_id": "12345abc...",
  "node_errors": {}  // Validation errors from ComfyUI
}
```

---

## 5. RUN EXECUTION FLOW

### 5.1 End-to-End Submission (Synchronous)

```
runSection(sectionId)
├─ enqueueProjectSectionRunRepo()
│  └─ Creates Run record with status="queued"
│     └─ Builds resolvedConfigSnapshot with all parameters
├─ getWorkerRun(runId)
│  └─ Reconstructs WorkerRunSnapshot from database
├─ submitRunToComfyUI(run)
│  ├─ buildComfyPromptDraft(run)
│  ├─ validateComfyPromptDraft()
│  │  └─ Fills workflow.api.json template
│  ├─ submitComfyPrompt()
│  │  └─ POST to ComfyUI /prompt endpoint
│  └─ Returns { comfyPromptId, validatedDraft, promptDraft }
├─ prisma.run.update()
│  └─ Store:
│     ├─ comfyPromptId
│     ├─ submittedPrompt (full API graph)
│     └─ executionMeta (seeds, sampler params, LoRAs)
└─ pollRunCompletion(runId) // Fire-and-forget
```

### 5.2 Polling (Asynchronous)

```
pollRunCompletion(runId)
├─ Load run from database
├─ Align status with ComfyUI queue (queued → running transition)
├─ waitForPromptToStart()
│  └─ Poll /queue until prompt enters queue_running
├─ pollComfyPromptHistory()
│  └─ Poll /history/{promptId} with automatic queue-aware timeout extension
├─ extractOutputImages(historyEntry)
├─ persistComfyOutputImages()
│  └─ Create ImageResult records with file paths
└─ completeWorkerRun()
   └─ Update run status to "done" or "failed"
```

---

## 6. DATABASE SCHEMA - WORKFLOW & RUN STORAGE

### 6.1 Run Model (Core)
```prisma
model Run {
  id                    String              @id @default(cuid())
  projectId             String
  projectSectionId      String
  runIndex              Int                 @default(1)          // Sequence number
  status                RunStatus           @default(queued)    // queued|running|done|failed
  
  // Configuration snapshot at time of submission
  resolvedConfigSnapshot Json               // Flattened section params
  
  // ComfyUI integration
  comfyPromptId         String?             // ID returned by /prompt
  submittedPrompt       Json?               // Full API prompt graph
  executionMeta         Json?               // Seeds, steps, cfg, LoRAs used
  
  // Output tracking
  outputDir             String?             // ComfyUI output subfolder
  comfyOutputSubfolder  String?
  errorMessage          String?
  
  // Timing
  startedAt             DateTime?
  finishedAt            DateTime?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  
  // Relations
  project               Project
  projectSection        ProjectSection
  images                ImageResult[]
}
```

### 6.2 resolvedConfigSnapshot Structure
```json
{
  "project": {
    "id": "proj_123",
    "title": "My Project",
    "slug": "my-project"
  },
  "section": {
    "id": "sec_456",
    "name": "Close-up Shot",
    "slug": "section_1",
    "templatePrompt": "...",
    "positivePrompt": "professional lighting",
    "negativePrompt": "blurry, low quality"
  },
  "promptBlocks": [
    { "positive": "character description", "negative": null },
    { "positive": "environment", "negative": "unwanted object" }
  ],
  "composedPrompt": {
    "positive": "full composed prompt",
    "negative": "all negative terms"
  },
  "parameters": {
    "aspectRatio": "9:16",
    "shortSidePx": 512,
    "batchSize": 1,
    "seedPolicy1": "random",
    "seedPolicy2": "random",
    "upscaleFactor": 2.0,
    "checkpointName": "model.safetensors"
  },
  "ksampler1": {
    "steps": 30,
    "cfg": 4,
    "sampler_name": "euler_ancestral",
    "scheduler": "karras",
    "denoise": 1
  },
  "ksampler2": {
    "steps": 20,
    "cfg": 4,
    "sampler_name": "euler_ancestral",
    "scheduler": "karras",
    "denoise": 0.5
  },
  "loraConfig": {
    "lora1": [
      { "path": "style/cinematic.safetensors", "weight": 0.8, "enabled": true }
    ],
    "lora2": [
      { "path": "enhance/detail.safetensors", "weight": 0.6, "enabled": true }
    ]
  }
}
```

### 6.3 executionMeta Structure
```json
{
  "ks1Seed": 1234567890,
  "ks1Steps": 30,
  "ks1Cfg": 4,
  "ks1Sampler": "euler_ancestral",
  "ks1Scheduler": "karras",
  "ks1Denoise": 1,
  
  "ks2Seed": 9876543210,
  "ks2Steps": 20,
  "ks2Cfg": 4,
  "ks2Sampler": "euler_ancestral",
  "ks2Scheduler": "karras",
  "ks2Denoise": 0.5,
  
  "positivePrompt": "full positive prompt used",
  "negativePrompt": "full negative prompt used",
  "aspectRatio": "9:16",
  "shortSidePx": 512,
  "batchSize": 1,
  "upscaleFactor": 2.0,
  "checkpointName": "model.safetensors",
  "workflowId": "project-slug",
  
  "lora1": [
    { "path": "style/cinematic.safetensors", "weight": 0.8, "enabled": true }
  ],
  "lora2": [
    { "path": "enhance/detail.safetensors", "weight": 0.6, "enabled": true }
  ]
}
```

### 6.4 ImageResult Model
```prisma
model ImageResult {
  id              String        @id @default(cuid())
  runId           String
  filePath        String        @unique  // ComfyUI output path
  thumbPath       String?                 // Thumbnail path
  width           Int?
  height          Int?
  fileSize        BigInt?
  reviewStatus    ReviewStatus  @default(pending)
  featured        Boolean       @default(false)
  reviewedAt      DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  run             Run
}
```

---

## 7. API ROUTES

### 7.1 Get Submitted Workflow
**Endpoint**: `GET /api/runs/{runId}/workflow`

Returns the submitted ComfyUI workflow as JSON download:

```typescript
// src/app/api/runs/[runId]/workflow/route.ts
const run = await prisma.run.findUnique({
  where: { id: runId },
  select: { submittedPrompt: true, projectSection: { select: { name: true } } }
});

// Response headers
{
  "Content-Type": "application/json",
  "Content-Disposition": "attachment; filename=\"workflow-{runId}.json\""
}
```

### 7.2 Submit Section Workflow
**Action**: `runSection(sectionId, overrideBatchSize?, options?)`

Server action in `src/lib/actions/run-execution.ts`:

```typescript
type RunSectionOptions = {
  prioritize?: boolean;  // Adds front:true to ComfyUI submission
};

runSection(sectionId, 1, { prioritize: true })
// Submits run with front=true to prioritize in ComfyUI queue
```

---

## 8. KEY CONFIGURATION SOURCES

### 8.1 Section Configuration (DB)
```prisma
model ProjectSection {
  id              String
  positivePrompt  String?       @db.Text
  negativePrompt  String?       @db.Text
  aspectRatio     String?       // "9:16", "4:3", etc.
  shortSidePx     Int?          // 512, 768, 1024
  batchSize       Int?
  seedPolicy1     String?       // "random", "fixed", "increment"
  seedPolicy2     String?
  ksampler1       Json?         // KSamplerParams
  ksampler2       Json?         // KSamplerParams
  upscaleFactor   Float?        // 1, 1.5, 2, 2.5, 3
  checkpointName  String?       // Model filename
  loraConfig      Json?         // { lora1: [], lora2: [] }
  extraParams     Json?         // Custom overrides
  promptBlocks    PromptBlock[] // Modular prompt components
}
```

### 8.2 Prompt Blocks (Modular Composition)
```prisma
model PromptBlock {
  id              String
  projectSectionId String
  type            PromptBlockType  // "preset" | "custom"
  sourceId        String?          // FK to Preset
  variantId       String?          // FK to PresetVariant
  label           String
  positive        String           @db.Text
  negative        String?          @db.Text
  sortOrder       Int              @default(0)
}
```

### 8.3 Environment Variables
```bash
COMFY_API_URL=http://127.0.0.1:8188
COMFY_REQUEST_TIMEOUT_MS=30000
COMFY_HISTORY_POLL_INTERVAL_MS=1000
COMFY_HISTORY_MAX_ATTEMPTS=300
COMFY_QUEUE_SNAPSHOT_CACHE_MS=5000
```

---

## 9. EXECUTION METADATA CAPTURE

### 9.1 When Metadata is Extracted
**Function**: `extractExecutionMeta(apiPrompt, promptDraft?)`

Executed after successful ComfyUI submission to capture:
- Actual seed values used (from KSampler1/2 nodes in submitted prompt)
- All parameter values from the submitted workflow
- LoRA summary (enabled entries only, with paths and weights)

### 9.2 Storage Location
- **Database**: `Run.executionMeta` JSON column
- **Query**: Fetch via `GET /api/runs/{runId}/` or through project/section queries
- **Retention**: Permanent (tied to Run record lifecycle)

---

## 10. WORKFLOW MODIFICATIONS & CUSTOMIZATION

### 10.1 Priority Resolution for Custom Workflows

When validating a prompt draft:

```typescript
// Priority 1: Explicit custom comfyPrompt in extraParams
if (extraParams.comfyPrompt && Object.keys(extraParams.comfyPrompt).length > 0) {
  return extraParams.comfyPrompt;
}

// Priority 2: Standard workflow.api.json (default)
const standardPrompt = await resolveStandardWorkflowPrompt(promptDraft);
if (standardPrompt) return standardPrompt;

// Priority 3: Fallback SDXL builder (last resort)
return buildFallbackPromptNodes(promptDraft);
```

### 10.2 Custom Workflow Injection
Via `ProjectSection.extraParams.comfyPrompt`:
```json
{
  "extraParams": {
    "comfyPrompt": {
      "1": { "inputs": { "ckpt_name": "custom.safetensors" }, "class_type": "CheckpointLoaderSimple" },
      "3": { "inputs": { /* ... */ }, "class_type": "KSampler" },
      // ... full custom workflow ...
    }
  }
}
```

---

## 11. FLOW DIAGRAM: SUBMISSION TO COMPLETION

```
┌─────────────────────────────────────────────────────┐
│ User clicks "Run Section"                           │
│ runSection(sectionId) server action                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ 1. Enqueue Runs     │
         │ Create Run record   │
         │ Status: "queued"    │
         │ resolvedConfigSnapshot stored
         └────────────┬────────┘
                      │
                      ▼
      ┌──────────────────────────────┐
      │ 2. Build Prompt Draft        │
      │ normalizeResolvedConfigSnapshot()
      │ buildComfyPromptDraft()      │
      └──────────────┬───────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │ 3. Validate Prompt           │
      │ validateComfyPromptDraft()   │
      │ Load workflow.api.json       │
      │ buildWorkflowPrompt()        │
      │ Fill nodes with parameters  │
      └──────────────┬───────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │ 4. Submit to ComfyUI         │
      │ POST /prompt                 │
      │ Return: prompt_id            │
      └──────────────┬───────────────┘
                     │
        ┌────────────┴─────────────┐
        │ Store in DB              │
        │ comfyPromptId            │
        │ submittedPrompt          │
        │ executionMeta            │
        └────────────┬─────────────┘
                     │
                     ▼ (Fire-and-forget)
      ┌──────────────────────────────┐
      │ 5. Poll ComfyUI (Async)      │
      │ pollRunCompletion()          │
      │ - GET /queue (status check)  │
      │ - GET /history/{id}          │
      │   (wait for completion)      │
      └──────────────┬───────────────┘
                     │
        ┌────────────┴─────────────┐
        │ Extract outputs          │
        │ extractOutputImages()    │
        │ persistComfyOutputImages()
        └────────────┬─────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │ 6. Complete Run              │
      │ completeWorkerRun()          │
      │ Status: "done"               │
      │ Create ImageResult records   │
      └──────────────────────────────┘
```

---

## 12. IMPLEMENTATION CHECKLIST FOR UNDERSTANDING

- [x] Workflow template format and location
- [x] Parameter resolution and node filling
- [x] ComfyUI API payload structure
- [x] Run submission and polling logic
- [x] Database schema for config storage
- [x] Execution metadata capture
- [x] Custom workflow overrides
- [x] Historical data retention
- [x] API routes for workflow access
- [x] Async polling and completion handling

