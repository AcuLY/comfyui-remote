# Quick Reference: Key File Paths & Functions

Classification: runbook
Current source: use `docs/index.md` first; current workflow contract lives in `docs/workflow.api.json`, worker boundaries live in `docs/worker-boundaries.md`, and generated file ownership lives in `docs/repo-inventory.md`.

## Critical Files

| File | Purpose | Key Exports |
|------|---------|---|
| `/src/server/services/comfyui-service.ts` | ComfyUI API interaction | `validateComfyPromptDraft()`, `executeComfyPromptDraft()`, `extractExecutionMeta()` |
| `/src/server/services/workflow-prompt-builder.ts` | Template filling | `buildWorkflowPrompt(WorkflowBuildInput)` |
| `/src/server/worker/payload-builder.ts` | Draft normalization | `buildComfyPromptDraft()`, `normalizeResolvedConfigSnapshot()` |
| `/src/server/services/image-result-service.ts` | Image persistence | `persistComfyOutputImages()` |
| `/src/server/worker/types.ts` | Type definitions | `ComfyPromptDraft`, `WorkerRunSnapshot` |
| `/prisma/schema.prisma` | Database schema | Models: `Run`, `ImageResult`, `ProjectSection` |
| `/docs/workflow.api.json` | Standard workflow template | ComfyUI node graph with 9 nodes |

## Workflow Generation Pipeline

```
Run (DB)
  ↓ [normalizeResolvedConfigSnapshot]
NormalizedResolvedConfigSnapshot
  ↓ [buildComfyPromptDraft]
ComfyPromptDraft {
  clientId, workflowId,
  prompt: {positive, negative},
  parameters: {...},
  checkpointName, ksampler1/2, loraConfig, extraParams,
  metadata: {...}
}
  ↓ [validateComfyPromptDraft]
ValidatedComfyPromptDraft {
  apiUrl, apiPrompt (JSON), extraData
}
  ↓ [submitComfyPrompt]
promptId: string
  ↓ [pollComfyPromptHistory]
ComfyPromptHistoryEntry
  ↓ [extractOutputImages, extractExecutionMeta]
ComfyPromptExecutionResult {
  comfyPromptId, outputDir, outputImages[], executionMeta
}
  ↓ [persistComfyOutputImages]
PersistedRunOutput {
  outputDir, images: [{filePath, thumbPath, width, height, fileSize}]
}
  ↓ [Create ImageResult records]
ImageResult[] (stored in DB)
```

## ImageResult Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | CUID | Primary key |
| `runId` | FK | Parent Run |
| `filePath` | String | Relative: `data/images/{proj}/{sect}/run-{N}-{id}/raw/{pad}.jpg` |
| `thumbPath` | String? | Relative: `data/images/{proj}/{sect}/run-{N}-{id}/thumb/{pad}.jpg` |
| `width`, `height` | Int? | Image dimensions |
| `fileSize` | BigInt? | In bytes |
| `reviewStatus` | Enum | {pending, kept, trashed} |
| `featured`, `featured2` | Boolean | Flag for highlighting |
| `reviewedAt` | DateTime? | When reviewed |
| `createdAt`, `updatedAt` | DateTime | Timestamps |

## Template Node Mapping

| Node ID | Type | Input Parameters | Usage |
|---------|------|------------------|-------|
| 1 | CheckpointLoaderSimple | `ckpt_name` | Load model checkpoint |
| 3 | KSampler | `seed`, `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise`, `model`, `positive`, `negative`, `latent_image` | Stage 1 generation |
| 407 | EmptyLatentImage | `width`, `height`, `batch_size` | Latent initialization |
| 425 | LatentUpscale | `width`, `height` | Upscale (HiresFix) — deleted if upscaleFactor=1 |
| 427 | KSampler | Same as node 3 | Stage 2 (HiresFix) — deleted if upscaleFactor=1 |
| 511 | Text Multiline | `text` | Positive prompt input |
| 513 | Text Multiline | `text` | Negative prompt input |
| 522 | Power Lora Loader | `lora_1`, `lora_2`, ... (dynamic) | LoRA stage 1 |
| 36 | Power Lora Loader | `lora_1`, `lora_2`, ... (dynamic) | LoRA stage 2 — deleted if upscaleFactor=1 |
| 515 | Image Save | `output_path`, `filename_prefix` | Save output images |

## Function Signatures (Copy-Paste Ready)

### Import Requirements
```typescript
import { ComfyPromptDraft, WorkerRunSnapshot, NormalizedResolvedConfigSnapshot } from '@/server/worker/types';
import { buildComfyPromptDraft, normalizeResolvedConfigSnapshot } from '@/server/worker/payload-builder';
import { buildWorkflowPrompt, WorkflowBuildInput } from '@/server/services/workflow-prompt-builder';
import { validateComfyPromptDraft, executeComfyPromptDraft, extractExecutionMeta, extractOutputImages } from '@/server/services/comfyui-service';
import { persistComfyOutputImages, PersistedRunOutput } from '@/server/services/image-result-service';
```

### Build Draft from Run
```typescript
const promptDraft: ComfyPromptDraft = buildComfyPromptDraft(run);
```

### Validate and Convert to API Prompt
```typescript
const validated = await validateComfyPromptDraft(apiUrl, promptDraft);
// validated.apiPrompt → ready to submit to ComfyUI
```

### Execute Full Pipeline
```typescript
const result = await executeComfyPromptDraft(apiUrl, promptDraft);
// result: {comfyPromptId, outputDir, outputImages[], executionMeta}
```

### Extract Metadata from Submitted Prompt
```typescript
const meta = extractExecutionMeta(validated.apiPrompt, promptDraft);
// meta: {ks1Seed, ks2Seed, ks1Steps, ks2Steps, ..., lora1, lora2}
```

### Persist Images to Disk
```typescript
const persisted = await persistComfyOutputImages(run, apiUrl, outputImages);
// persisted: {outputDir, images: [{filePath, thumbPath, width, height, fileSize}]}
```

## Priority System for Prompt Resolution

1. **Custom API Prompt** (in `extraParams`)
   - Check for keys: `comfyPrompt`, `workflowApiPrompt`, `apiPrompt`
   - If found and non-empty, use directly

2. **Standard Workflow** (from `docs/workflow.api.json`)
   - Load template, deep-clone, fill nodes
   - Fill prompts, dimensions, LoRAs, KSampler params, output path

3. **Fallback Prompt** (built-in txt2img)
   - Minimal nodes: Checkpoint → CLIP → KSampler → VAE → Save
   - Nodes: 1, 3, 4, 5, 6, 7, 8
   - Used only if template file missing

## Key Constants & Ranges

| Item | Value | Notes |
|------|-------|-------|
| Seed max | 4,294,967,295 | 32-bit unsigned integer |
| Thumbnail max dim | 400px | Preserves aspect ratio |
| Thumbnail quality | 80 | JPEG quality percent |
| Image quality | 90 | JPEG quality percent |
| Upscale factor default | 2 | 2x = 1024×1536 from 512×768 |
| Upscale round unit | 8 | Round to nearest multiple for latent alignment |

## Path Sanitization Rules

```typescript
// Accepts: letters, numbers, dots, underscores, hyphens
// Converts: Unicode-aware
// Examples:
"My Project!" → "My-Project"
"角色 名" → "名"  (if no alphanumeric kept)
"....-" → "" (falls back to fallback)
```

## Windows File Handling

- **Atomic Writes:** Write temp → delete target → rename temp
- **EBUSY Retry:** Exponential backoff (200ms, 400ms, 800ms, ...)
- **Max Retries:** 5 attempts
- **Path Format:** Always Unix-style `/` separators in ComfyUI API calls

## ComfyUI API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/prompt` | POST | Submit workflow |
| `/history/{prompt_id}` | GET | Poll execution status |
| `/view` | GET | Download output image |
| `/queue` | GET | Check queue status |
| `/queue` | POST | Delete queue items |
| `/interrupt` | POST | Interrupt current execution |

## Image Download/Save Flow

```
ComfyUI /view?filename=...&subfolder=...&type=output
  ↓ [downloadOutputImageBuffer]
Buffer
  ↓ [sharp.rotate().jpeg({quality:90})]
JPEG Buffer
  ↓ [atomicWriteFile]
data/images/{proj}/{sect}/run-{N}-{id}/raw/{pad}.jpg
  ↓ [createThumbnail]
data/images/{proj}/{sect}/run-{N}-{id}/thumb/{pad}.jpg
  ↓ [sharp.stat()]
{width, height} → stored in ImageResult
```

## Common Pitfalls

❌ **Don't:** Mutate workflow template without deep-clone  
✅ **Do:** `const cloned = JSON.parse(JSON.stringify(template))`

❌ **Don't:** Use backslashes in ComfyUI API paths  
✅ **Do:** `.replace(/\\/g, "/")`

❌ **Don't:** Assume output images are always present  
✅ **Do:** Check `outputImages.length > 0` before persisting

❌ **Don't:** Store raw PNG from ComfyUI  
✅ **Do:** Convert to JPEG (quality 90) via sharp

❌ **Don't:** Wait for prompt to complete without polling queue  
✅ **Do:** Call `waitForPromptToStart()` first, then poll history

❌ **Don't:** Skip thumbnail generation  
✅ **Do:** Always create 400px thumbnails for UI performance

---

## Database Indexes

### ImageResult
- `(reviewStatus, createdAt)` — Filter by review status
- `(runId, createdAt)` — Get images per run

### Run
- `(status, createdAt)` — Monitor execution
- `(projectId, createdAt)` — Project history
- `(projectSectionId, createdAt)` — Section history

## Example: Create Custom Workflow Node

```typescript
// In custom service
function buildCustomWorkflowPrompt(template: JsonRecord, inputImagePath: string): JsonRecord {
  const cloned = JSON.parse(JSON.stringify(template));
  
  // Add LoadImage node
  cloned["9"] = {
    class_type: "LoadImage",
    inputs: { image: inputImagePath },
    _meta: { title: "Load Image" }
  };
  
  // Rewire node 407 (EmptyLatentImage) → RemoveOutputImages (instead of LoadImage)
  // Rewire node 3 (KSampler) latent_image to come from node 9 (LoadImage)
  // Adjust denoise to 0.5 for img2img
  
  return cloned;
}
```
