# ComfyUI Remote - Codebase Architecture Analysis

## 1. Database Schema (Prisma)

### Run Model - Core Execution Record
```prisma
model Run {
  id                    String          @id
  projectId             String
  projectSectionId      String
  runIndex              Int
  status                RunStatus       // queued | running | done | failed | cancelled | paused
  resolvedConfigSnapshot Json           // Full resolved config at submission time
  comfyPromptId         String?         // ComfyUI prompt ID from /prompt endpoint
  executionMeta         Json?           // { ks1Seed, ks2Seed, ks1Steps, ks1Cfg, ... }
  submittedPrompt       Json?           // FULL ComfyUI workflow JSON sent to /prompt
  outputDir             String?         // Path to output images on server
  comfyOutputSubfolder  String?         // Subfolder within outputDir
  errorMessage          String?
  startedAt             DateTime?
  finishedAt            DateTime?
  createdAt             DateTime
  updatedAt             DateTime
  project               Project
  projectSection        ProjectSection
  images                ImageResult[]   // Reference to saved images
}
```

**Key Storage Fields:**
- **`resolvedConfigSnapshot`** (Json): Complete configuration snapshot at run submission
- **`submittedPrompt`** (Json): **THE FULL COMFYUI WORKFLOW JSON** - this is the complete graph sent to `/prompt`
- **`executionMeta`** (Json): Extracted metadata (seeds, steps, CFG, sampler names, prompts, LoRA summaries)

### ProjectSection Model - Workflow Template Storage
```prisma
model ProjectSection {
  // ... other fields
  positivePrompt        String?
  negativePrompt        String?
  aspectRatio           String?
  shortSidePx           Int?
  batchSize             Int?
  seedPolicy1           String?       // "random" | "fixed" | "increment"
  seedPolicy2           String?       
  ksampler1             Json?         // KSamplerParams for first stage
  ksampler2             Json?         // KSamplerParams for hires-fix stage
  upscaleFactor         Float?        // 1/1.5/2/2.5/3 (default 2)
  checkpointName        String?
  loraConfig            Json?         // { lora1: LoraEntry[], lora2: LoraEntry[] }
  extraParams           Json?
  promptBlocks          PromptBlock[] // Array of prompt components
  latestRunId           String?
}
```

---

## 2. Workflow Building Architecture

### Template File: `docs/workflow.api.json`

The system uses a **single hardcoded ComfyUI workflow template** with these key nodes:

| Node ID | Type | Purpose |
|---------|------|---------|
| **1** | CheckpointLoaderSimple | Loads the model checkpoint |
| **407** | EmptyLatentImage | Creates blank latent (width, height, batch_size) |
| **511** | Text Multiline | Positive prompt input |
| **513** | Text Multiline | Negative prompt input |
| **4** | CLIPTextEncode | Encodes positive prompt (stage 1) |
| **12** | CLIPTextEncode | Encodes negative prompt (stage 1) |
| **522** | Power Lora Loader | **LoRA Stage 1** - loads LoRAs for KSampler1 |
| **3** | KSampler | **KSampler1** - first generation stage (30 steps, denoise=1) |
| **425** | LatentUpscale | Upscales latent by factor (e.g., 2x) - CONDITIONALLY INCLUDED |
| **36** | Power Lora Loader | **LoRA Stage 2** - loads LoRAs for KSampler2 - CONDITIONALLY INCLUDED |
| **519** | CLIPTextEncode | Encodes positive for stage 2 - CONDITIONALLY INCLUDED |
| **520** | CLIPTextEncode | Encodes negative for stage 2 - CONDITIONALLY INCLUDED |
| **427** | KSampler | **KSampler2** - hires-fix generation (30 steps, denoise=0.6) - CONDITIONALLY INCLUDED |
| **410** | VAEDecode | Decodes final latent → pixels |
| **515** | Image Save | Saves output images |

### Conditional Workflow Logic

**If `upscaleFactor === 1` (bypass hires-fix):**
- Deletes nodes: 425 (LatentUpscale), 427 (KSampler2), 36 (LoRA2)
- Rewires: VAEDecode (410) → reads from KSampler1 (3) instead of KSampler2

**If `upscaleFactor > 1` (default 2x):**
- Keeps full two-stage pipeline
- LatentUpscale (425) resizes latent to `ceil(width*factor/8)*8` × `ceil(height*factor/8)*8`
- KSampler2 processes upscaled latent with separate LoRAs and parameters

---

## 3. Workflow Building Pipeline

### Entry Point: `buildComfyPromptDraft()` 
**File:** `src/server/worker/payload-builder.ts`

Creates intermediate `ComfyPromptDraft` from `WorkerRunSnapshot`:

```typescript
type ComfyPromptDraft = {
  clientId: string;
  workflowId: string;
  prompt: {
    positive: string;
    negative: string | null;
  };
  parameters: {
    aspectRatio: string | null;
    shortSidePx: number | null;
    batchSize: number | null;
    upscaleFactor: number | null;
    checkpointName: string | null;
  };
  checkpointName: string | null;
  ksampler1: Prisma.JsonObject | null;    // KSamplerParams
  ksampler2: Prisma.JsonObject | null;    // KSamplerParams
  loraConfig: Prisma.JsonObject | null;   // { lora1, lora2 }
  extraParams: Prisma.JsonObject | null;
  metadata: { runId, runIndex, projectId, sectionId, ... };
};
```

### Step 2: Template Filling - `buildWorkflowPrompt()`
**File:** `src/server/services/workflow-prompt-builder.ts`

Fills `workflow.api.json` template with parameters:

```typescript
type WorkflowBuildInput = {
  workflowTemplate: Record<string, unknown>;
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  batchSize: number;
  upscaleFactor?: number;
  checkpointName?: string;
  lora1List: LoraBinding[];    // Power Lora Loader entries
  lora2List: LoraBinding[];    // Power Lora Loader entries
  ksampler1: KSamplerParams;
  ksampler2: KSamplerParams;
  outputPath: string;          // e.g., "MyProject/1.close_up_shot"
  runId?: string;              // filename_prefix to avoid collisions
};
```

**Actions per node:**

| Node | Field | Value |
|------|-------|-------|
| 1 | ckpt_name | checkpointName |
| 407 | width, height, batch_size | Calculated from aspectRatio, shortSidePx |
| 511 | text | positivePrompt |
| 513 | text | negativePrompt |
| 522 | lora_1, lora_2... | lora1List entries (Path Lora Loader format) |
| 3 | steps, cfg, sampler_name, scheduler, denoise, seed | KSampler1 params |
| 425 | width, height | upscaled dimensions (rounded to 8x8) |
| 36 | lora_1, lora_2... | lora2List entries |
| 427 | steps, cfg, sampler_name, scheduler, denoise, seed | KSampler2 params |
| 515 | output_path, filename_prefix | outputPath, runId |

### Step 3: Validation & Submission - `submitComfyPrompt()`
**File:** `src/server/services/comfyui-service.ts`

Submits to `ComfyUI /prompt` endpoint:
- Returns `comfyPromptId` (unique prompt identifier)
- Server stores **full API prompt JSON** in `Run.submittedPrompt`

---

## 4. KSampler Configuration

### Types
**File:** `src/lib/lora-types.ts`

```typescript
type KSamplerParams = {
  steps?: number;          // Default: 30
  cfg?: number;            // Default: 4 (KS1) / 7 (KS2)
  sampler_name?: string;   // Default: "euler_ancestral" (KS1) / "dpmpp_2m" (KS2)
  scheduler?: string;      // Default: "karras"
  denoise?: number;        // Default: 1 (KS1) / 0.6 (KS2)
  seedPolicy?: SeedPolicy; // "random" | "fixed" | "increment"
};

const DEFAULT_KSAMPLER1 = {
  steps: 30,
  cfg: 4,
  sampler_name: "euler_ancestral",
  scheduler: "karras",
  denoise: 1,
  seedPolicy: "random",
};

const DEFAULT_KSAMPLER2 = {
  steps: 30,
  cfg: 7,
  sampler_name: "dpmpp_2m",
  scheduler: "karras",
  denoise: 0.6,
  seedPolicy: "random",
};
```

### Seed Resolution
**Function:** `resolveSeed()` in `workflow-prompt-builder.ts`

- **Policy: "fixed"** → Always use seed `42`
- **Policy: "increment"** → Falls through to "random" (no persistent seed tracking)
- **Policy: "random"** → `Math.floor(Math.random() * 4294967295)`
- Max seed: `2^32 - 1` for ComfyUI compatibility

**Result:** Actual seed used is **stored in `Run.executionMeta.ks1Seed` / `ks2Seed`**

---

## 5. Latent Space & VAE Handling

### Latent Image Node (407)

Dimensions calculated from:
1. **AspectRatio** (e.g., "16:9") + **shortSidePx** (e.g., 512px)
   - Calculated via `resolveResolution()` → dimensions in pixels
2. **Direct width/height** if provided
3. **Round to 8-pixel boundaries** (latent space alignment requirement)

```typescript
// Example: 16:9 @ 512px → 512×288
// Then submitted as width=512, height=288 to EmptyLatentImage (node 407)
```

### LatentUpscale Node (425)

Upscales latent dimensions by factor:
```typescript
upscaledWidth = Math.round((width * upscaleFactor) / 8) * 8;
upscaledHeight = Math.round((height * upscaleFactor) / 8) * 8;
// Ensures dimensions stay aligned to 8-pixel blocks
```

### VAEDecode (410)

- **Inputs from:** KSampler2 (427) if hires-fix active, else KSampler1 (3)
- **Uses:** VAE from checkpoint (node 1, output slot 2)
- **Output:** Pixel images → Image Save (515)

**No explicit latent caching** - all latent data flows through the ComfyUI API in this workflow.

---

## 6. LoRA Handling

### Storage Structure

**ProjectSection.loraConfig:**
```typescript
{
  lora1: LoraEntry[],    // For KSampler1 stage
  lora2: LoraEntry[]     // For KSampler2 stage
}

type LoraEntry = {
  id: string;            // Unique ID
  path: string;          // e.g., "path/to/lora.safetensors"
  weight: number;        // 0.00 - 2.00
  enabled: boolean;
  source: "preset" | "manual";
  sourceLabel?: string;  // e.g., "角色"
  sourceName?: string;   // e.g., "Miku"
  bindingId?: string;    // Groups related LoRAs
  groupBindingId?: string;
  suppressed?: boolean;  // Soft-deleted preset LoRA
  // ... other fields for tracking preset changes
};
```

### Power Lora Loader (nodes 522, 36)

**Input format:**
```json
{
  "model": ["checkpoint", 0],
  "clip": ["checkpoint", 1],
  "lora_1": { "on": true, "lora": "path/to/lora1.safetensors", "strength": 0.8 },
  "lora_2": { "on": true, "lora": "path/to/lora2.safetensors", "strength": 1.2 }
}
```

Dynamically generates `lora_N` entries from `LoraEntry[]` list.

---

## 7. Run Execution Flow

### Phase 1: Submission (Synchronous)

**File:** `src/server/services/run-executor.ts`

```
Server Action (runProject/runSection)
  ↓
submitRunToComfyUI(WorkerRunSnapshot)
  ├─ buildComfyPromptDraft() → ComfyPromptDraft
  ├─ validateComfyPromptDraft() → ValidatedComfyPromptDraft (with apiPrompt)
  ├─ submitComfyPrompt() → comfyPromptId (to ComfyUI /prompt endpoint)
  ├─ Create DB Run record with:
  │   ├─ status = "queued"
  │   ├─ comfyPromptId
  │   ├─ submittedPrompt = full JSON workflow
  │   ├─ executionMeta = extracted metadata
  │   └─ resolvedConfigSnapshot = full config
  └─ Fire-and-forget: pollRunCompletion(runId)
```

### Phase 2: Polling (Async)

**Function:** `pollRunCompletion()` in `run-executor.ts`

```
Poll ComfyUI queue state every 2 seconds
  ├─ waitForPromptToStart() → transitions queued → running
  └─ pollComfyPromptHistory() → waits for completion
       ├─ Extracts output images from ComfyUI history
       ├─ Persists images to file system
       ├─ Saves workflow.json alongside images
       └─ Updates Run.status = "done"
         └─ Stores executionMeta
```

### Data Stored After Completion

**Run record contains:**
- `submittedPrompt`: Full workflow JSON
- `executionMeta`: 
  ```json
  {
    "ks1Seed": 123456,
    "ks1Steps": 30,
    "ks1Cfg": 4,
    "ks1Sampler": "euler_ancestral",
    "ks1Scheduler": "karras",
    "ks1Denoise": 1,
    "ks2Seed": 654321,
    "ks2Steps": 30,
    "ks2Cfg": 7,
    "ks2Sampler": "dpmpp_2m",
    "ks2Scheduler": "karras",
    "ks2Denoise": 0.6,
    "positivePrompt": "...",
    "negativePrompt": "...",
    "aspectRatio": "16:9",
    "shortSidePx": 512,
    "batchSize": 1,
    "upscaleFactor": 2,
    "checkpointName": "model.safetensors",
    "lora1": [{ path, weight, enabled }...],
    "lora2": [{ path, weight, enabled }...]
  }
  ```
- `outputDir`: Path to saved images
- `comfyOutputSubfolder`: Subfolder within outputDir

---

## 8. Key Files & Responsibilities

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (Run, ProjectSection models) |
| `docs/workflow.api.json` | ComfyUI workflow template (immutable) |
| `src/lib/lora-types.ts` | Type definitions: KSamplerParams, LoraEntry |
| `src/server/services/workflow-prompt-builder.ts` | Fills template with parameters → API JSON |
| `src/server/services/comfyui-service.ts` | ComfyUI API communication |
| `src/server/services/run-executor.ts` | Run lifecycle: submit, poll, complete |
| `src/server/worker/payload-builder.ts` | Builds intermediate ComfyPromptDraft |
| `src/server/worker/types.ts` | WorkerRunSnapshot, ComfyPromptDraft types |
| `src/components/ksampler-panel.tsx` | UI for KSampler parameter editing |
| `src/server/services/section-workflow-service.ts` | Builds workflow for download/preview |

---

## 9. Key Insights

### Architecture Pattern: Submit → Poll → Finalize
1. **Synchronous submission** creates Run in DB, submits to ComfyUI
2. **Async polling** watches ComfyUI queue
3. **Finalization** persists images and metadata

### Multi-Stage Pipeline
- **Stage 1 (KSampler1):** Generate at base resolution with LoRA1
- **Stage 2 (KSampler2):** Upscale latent + refine with LoRA2 (denoise=0.6)
- **VAE Decode:** Convert final latent → pixels
- **Conditional:** Can bypass stage 2 if upscaleFactor=1

### Latent Space
- **Immutable in DB:** No intermediate latent storage
- **In-workflow:** Latent passes through ComfyUI nodes (407→3→425→427→410)
- **Alignment:** All dimensions enforced to 8-pixel boundaries

### Data Integrity
- **Full workflow JSON stored** in `Run.submittedPrompt` for auditability
- **Execution metadata extracted** and summarized in `Run.executionMeta`
- **workflow.json saved** alongside output images in `outputDir`

### Seed Management
- Policies: random, fixed (42), increment (falls back to random)
- **Actual seeds stored** in `executionMeta` for reproducibility
- No cross-run seed sequence tracking

---

## 10. Example Workflow Submission

### Input Configuration
```typescript
{
  projectId: "proj-123",
  section: {
    aspectRatio: "16:9",
    shortSidePx: 512,           // → 512×288 latent
    upscaleFactor: 2,
    ksampler1: { steps: 30, cfg: 4, sampler_name: "euler_ancestral", denoise: 1 },
    ksampler2: { steps: 20, cfg: 7, sampler_name: "dpmpp_2m", denoise: 0.6 },
    positivePrompt: "a beautiful portrait",
    negativePrompt: "blurry, ugly",
    lora1: [{ path: "char/miku.safetensors", weight: 1.0, enabled: true }],
    lora2: [{ path: "style/cinematic.safetensors", weight: 0.7, enabled: true }]
  }
}
```

### Generated Workflow (Simplified)
```json
{
  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "model.safetensors" } },
  "407": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 288, "batch_size": 1 } },
  "511": { "class_type": "Text Multiline", "inputs": { "text": "a beautiful portrait" } },
  "513": { "class_type": "Text Multiline", "inputs": { "text": "blurry, ugly" } },
  "522": { 
    "class_type": "Power Lora Loader", 
    "inputs": { 
      "model": ["1", 0], 
      "clip": ["1", 1],
      "lora_1": { "on": true, "lora": "char/miku.safetensors", "strength": 1.0 }
    } 
  },
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["522", 0],
      "positive": ["4", 0],
      "negative": ["12", 0],
      "latent_image": ["407", 0],
      "steps": 30,
      "cfg": 4,
      "sampler_name": "euler_ancestral",
      "scheduler": "karras",
      "denoise": 1,
      "seed": 1234567890
    }
  },
  "425": { "class_type": "LatentUpscale", "inputs": { "width": 1024, "height": 576, "samples": ["3", 0] } },
  "427": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["36", 0],
      "positive": ["519", 0],
      "negative": ["520", 0],
      "latent_image": ["425", 0],
      "steps": 20,
      "cfg": 7,
      "sampler_name": "dpmpp_2m",
      "scheduler": "karras",
      "denoise": 0.6,
      "seed": 9876543210
    }
  },
  "410": { "class_type": "VAEDecode", "inputs": { "samples": ["427", 0], "vae": ["1", 2] } },
  "515": { "class_type": "Image Save", "inputs": { "images": ["410", 0], "output_path": "output", "filename_prefix": "run-123" } }
}
```

### Result in Database
```typescript
Run {
  id: "run-123",
  status: "done",
  comfyPromptId: "comfy-prompt-456",
  submittedPrompt: { /* full workflow JSON above */ },
  executionMeta: {
    ks1Seed: 1234567890,
    ks1Steps: 30,
    ks2Seed: 9876543210,
    ks2Steps: 20,
    // ... all parameters captured
  },
  outputDir: "outputs/run-123",
  images: [
    { filePath: "outputs/run-123/image_001.png", width: 1024, height: 576 }
  ]
}
```

