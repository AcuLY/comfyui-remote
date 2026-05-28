# ComfyUI Remote - Codebase Search Summary

## Search Results Overview

### ✅ Found & Documented

1. **Prisma Schema** ✅
   - Location: `/prisma/schema.prisma`
   - Run model stores: `submittedPrompt` (full JSON), `executionMeta` (extracted), `resolvedConfigSnapshot`
   - ProjectSection model: KSampler params, LoRA config, prompt blocks

2. **Workflow Building Files** ✅
   - `src/server/services/workflow-prompt-builder.ts` - Fills template with parameters
   - `src/server/worker/payload-builder.ts` - Builds intermediate ComfyPromptDraft
   - `src/server/services/comfyui-service.ts` - API submission & validation
   - `src/server/services/run-executor.ts` - Full execution lifecycle

3. **KSampler References** ✅
   - Found in: `ksampler-panel.tsx`, `lora-types.ts`, `workflow-prompt-builder.ts`
   - Two distinct KSampler stages: KSampler1 (base) & KSampler2 (hires-fix)
   - Full type definitions with defaults in `lora-types.ts`

4. **Workflow Template** ✅
   - Location: `docs/workflow.api.json`
   - 14 ComfyUI nodes with hardcoded IDs
   - Supports conditional multi-stage pipeline

---

## Key Architecture Findings

### Database Storage Model

| Field | Contents | Purpose |
|-------|----------|---------|
| `Run.submittedPrompt` | **Full ComfyUI workflow JSON** | Complete audit trail, reproducibility |
| `Run.executionMeta` | Extracted metadata (seeds, params, prompts, LoRAs) | Quick access, summary view |
| `Run.resolvedConfigSnapshot` | Full configuration at submission | Track what was actually used |
| `ProjectSection.ksampler1/2` | KSamplerParams JSON | Template for future runs |
| `ProjectSection.loraConfig` | { lora1: [], lora2: [] } | LoRA assignments by stage |

### Multi-Stage KSampler Workflow

**Two-Stage Pipeline (Default: upscaleFactor > 1):**
1. **KSampler1 (Node 3)** → Generate at base resolution with LoRA1
   - Default: 30 steps, CFG=4, euler_ancestral, denoise=1.0
   - Input: 407 (EmptyLatentImage)
   - LoRA source: Node 522 (Power Lora Loader)

2. **LatentUpscale (Node 425)** → Upscale latent by factor
   - Dimensions rounded to 8-pixel boundaries for latent compatibility

3. **KSampler2 (Node 427)** → Refine upscaled latent with LoRA2
   - Default: 30 steps, CFG=7, dpmpp_2m, denoise=0.6 (inpaint mode)
   - Input: 425 (LatentUpscale output)
   - LoRA source: Node 36 (Power Lora Loader)

4. **VAEDecode (Node 410)** → Convert latent → pixels
   - Uses VAE from checkpoint (node 1, slot 2)

5. **ImageSave (Node 515)** → Persist to disk

**Single-Stage Pipeline (upscaleFactor = 1):**
- Deletes nodes: 425, 427, 36
- Rewires: 410 reads directly from node 3

### Latent Space Handling

**No explicit latent storage/caching:**
- Latent data flows entirely through ComfyUI API
- Node 407 (EmptyLatentImage) creates fresh latent each run
- Dimensions calculated from aspect ratio + short side pixel value
- Enforced 8-pixel alignment: `Math.round(dimension / 8) * 8`

**Latent flow:**
```
407 (EmptyLatent) → 3 (KS1) → [425 (Upscale) → 427 (KS2)] → 410 (VAEDecode) → 515 (Save)
```

### LoRA Architecture

**Two-Stage LoRA Support:**
- **lora1** (nodes 522 → 3): Applied during base generation
- **lora2** (nodes 36 → 427): Applied during hires-fix refinement (conditionally)

**Format: Power Lora Loader (rgthree)**
```json
{
  "model": ["checkpoint", 0],
  "clip": ["checkpoint", 1],
  "lora_1": { "on": true, "lora": "path/file.safetensors", "strength": 0.8 },
  "lora_2": { "on": true, "lora": "path/file.safetensors", "strength": 1.2 }
}
```

**Storage per LoRA:**
- Path, weight (0-2.0), enabled flag
- Source tracking: "preset" or "manual"
- Binding IDs for tracking preset syncing
- Support for soft-delete (suppressed flag)

---

## Prompt Building Process

### Step 1: Resolve Template → ComfyPromptDraft
- File: `payload-builder.ts`
- Normalizes `WorkerRunSnapshot` + `resolvedConfigSnapshot`
- Creates intermediate `ComfyPromptDraft` (not yet workflow JSON)

### Step 2: Fill Template → API JSON
- File: `workflow-prompt-builder.ts`
- Deep-clones `docs/workflow.api.json`
- Fills each node's inputs:
  - Node 1: checkpoint name
  - Node 407: width, height, batch_size
  - Nodes 511/513: prompts
  - Nodes 4/12/519/520: clip encodings
  - Nodes 522/36: LoRA entries
  - Nodes 3/427: KSampler parameters
  - Node 425: upscale dimensions
  - Node 515: output path + run ID

### Step 3: Validate & Submit
- File: `comfyui-service.ts`
- Submits JSON to ComfyUI `/prompt` endpoint
- Returns `comfyPromptId`
- Full JSON stored in `Run.submittedPrompt`

---

## Execution Data Capture

### What Gets Stored After Completion

**In `Run.executionMeta`:**
```typescript
{
  // KSampler1 stage
  ks1Seed: number,           // Actual seed used (from resolved workflow)
  ks1Steps: number,
  ks1Cfg: number,
  ks1Sampler: string,        // e.g., "euler_ancestral"
  ks1Scheduler: string,      // e.g., "karras"
  ks1Denoise: number,
  
  // KSampler2 stage (if applicable)
  ks2Seed: number,
  ks2Steps: number,
  ks2Cfg: number,
  ks2Sampler: string,
  ks2Scheduler: string,
  ks2Denoise: number,
  
  // Prompts (from promptDraft)
  positivePrompt: string,
  negativePrompt: string,
  
  // Dimensions
  aspectRatio: string,       // e.g., "16:9"
  shortSidePx: number,
  batchSize: number,
  upscaleFactor: number,
  checkpointName: string,
  
  // LoRA summary (enabled only)
  lora1: [{ path, weight, enabled }...],
  lora2: [{ path, weight, enabled }...]
}
```

**In `Run.submittedPrompt`:**
- Complete ComfyUI workflow JSON (all 14 nodes with full inputs)
- Extracted from `ValidatedComfyPromptDraft.apiPrompt`

**On Disk (alongside images):**
- `workflow.json` - Copy of submitted workflow for reference

---

## Key Code Paths

### Submission Flow
```
Server Action (runProject/runSection)
  → submitRunToComfyUI()
    → buildComfyPromptDraft(WorkerRunSnapshot)
    → validateComfyPromptDraft() // gets apiPrompt
    → submitComfyPrompt() // POST to /prompt
  → Create Run record (status=queued)
  → Fire pollRunCompletion(runId)

Async Polling:
  pollRunCompletion()
    → waitForPromptToStart() // queued → running
    → pollComfyPromptHistory() // wait for completion
    → extractOutputImages() // from history
    → persistComfyOutputImages() // to disk
    → Save workflow.json
    → completeWorkerRun() // status=done
```

### Important Files
```
prisma/schema.prisma ..................... Database models
docs/workflow.api.json ................... Template
src/lib/lora-types.ts .................... KSamplerParams, LoraEntry types
src/server/services/
  ├─ workflow-prompt-builder.ts ......... Template filling
  ├─ comfyui-service.ts ................ API communication
  └─ run-executor.ts ................... Lifecycle management
src/server/worker/
  ├─ payload-builder.ts ............... ComfyPromptDraft building
  └─ types.ts ......................... WorkerRunSnapshot, ComfyPromptDraft
src/components/ksampler-panel.tsx ........ KSampler UI
```

---

## Key Takeaways

### What the System Does
1. **Stores complete workflows** - `Run.submittedPrompt` has full JSON for reproducibility
2. **Two-stage generation** - KSampler1 + LatentUpscale + KSampler2 (or single stage if upscale=1)
3. **Per-stage LoRAs** - lora1 for initial gen, lora2 for hires-fix refinement
4. **Latent-based upscaling** - Uses ComfyUI's LatentUpscale, not image upscaling
5. **Metadata extraction** - Seeds, params, prompts captured for future reference

### What's NOT in the System
- ❌ Explicit latent checkpoint storage (flows through API)
- ❌ Cross-run seed sequence (each run independently random)
- ❌ Custom workflow graphs (one hardcoded template)
- ❌ Node-level parameter overrides (only template-level)

### Architecture Pattern
**Template → Draft → Workflow JSON → ComfyUI API → Poll → Finalize**

The system maintains a clean separation between:
- **Template layer** (static `workflow.api.json`)
- **Config layer** (`ProjectSection` + `resolvedConfigSnapshot`)
- **Execution layer** (workflow JSON submitted to ComfyUI)
- **Result layer** (`executionMeta` + images + `workflow.json`)

