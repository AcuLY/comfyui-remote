# ComfyUI Remote - Quick Reference Guide

## 🎯 Quick Answers

### Q: Where is the Run/Task database schema?
**A:** `prisma/schema.prisma` - Lines 431-455
- Stores: `submittedPrompt` (full JSON), `executionMeta` (metadata), `resolvedConfigSnapshot` (config)

### Q: How are ComfyUI prompts built?
**A:** Two-step process:
1. `buildComfyPromptDraft()` in `src/server/worker/payload-builder.ts`
2. `buildWorkflowPrompt()` in `src/server/services/workflow-prompt-builder.ts` ← fills template

### Q: What's the workflow template?
**A:** `docs/workflow.api.json` - Single immutable ComfyUI graph with 14 nodes

### Q: How many KSamplers are there?
**A:** **Two (conditionally):**
- **KSampler1** (node 3) - Always: base generation, 30 steps, cfg=4, denoise=1
- **KSampler2** (node 427) - Conditional: hires-fix refinement if upscaleFactor > 1, 30 steps, cfg=7, denoise=0.6

### Q: Where are KSampler parameters defined?
**A:** `src/lib/lora-types.ts` - Lines 40-67
```typescript
type KSamplerParams = {
  steps, cfg, sampler_name, scheduler, denoise, seedPolicy
}
```

### Q: How is latent space handled?
**A:** 
- Created fresh each run (node 407: EmptyLatentImage)
- Dimensions: aspect ratio + short side pixels, rounded to 8-pixel boundaries
- Upscaled via LatentUpscale node (425), NOT image upscaling
- No explicit storage - flows through ComfyUI API

### Q: How are LoRAs applied?
**A:** Two-stage Power Lora Loader:
- **lora1** (node 522 → KSampler1): initial generation
- **lora2** (node 36 → KSampler2): hires-fix refinement

### Q: What gets stored after a run completes?
**A:** In `Run` record:
- `submittedPrompt`: Full workflow JSON
- `executionMeta`: Seeds, steps, cfg, sampler names, prompts, dimensions, LoRA list
- Plus `workflow.json` file saved alongside output images

---

## 🔗 File Navigation

### Core Database
- **Schema:** `prisma/schema.prisma`
- **Run Model:** Lines 431-455
- **ProjectSection Model:** Lines 349-380

### Workflow Execution
- **Template:** `docs/workflow.api.json`
- **Template Filling:** `src/server/services/workflow-prompt-builder.ts`
- **Draft Building:** `src/server/worker/payload-builder.ts`
- **Submission:** `src/server/services/run-executor.ts`
- **ComfyUI API:** `src/server/services/comfyui-service.ts`

### Types & Definitions
- **KSampler Types:** `src/lib/lora-types.ts`
- **Worker Types:** `src/server/worker/types.ts`
- **LoRA Types:** `src/lib/lora-types.ts` (line 10-30)

### UI Components
- **KSampler Panel:** `src/components/ksampler-panel.tsx`
- **Sampler Options:** Lines 12-42

---

## 📊 Data Models

### Run Model Key Fields
```
submittedPrompt    → Full workflow JSON (reproducibility)
executionMeta      → Extracted: ks1Seed, ks1Steps, ks1Cfg, ks1Sampler, 
                     ks1Scheduler, ks1Denoise, + same for ks2, 
                     positivePrompt, negativePrompt, aspectRatio, 
                     shortSidePx, batchSize, upscaleFactor, 
                     checkpointName, lora1, lora2
resolvedConfigSnapshot → Full configuration at submission
comfyPromptId      → ComfyUI prompt ID (from /prompt response)
status             → queued | running | done | failed | cancelled | paused
outputDir          → Path to saved images
```

### KSamplerParams Type
```typescript
{
  steps?: number              // Default: 30
  cfg?: number                // Default: 4 (KS1) / 7 (KS2)
  sampler_name?: string       // Default: "euler_ancestral" (KS1) / "dpmpp_2m" (KS2)
  scheduler?: string          // Default: "karras"
  denoise?: number            // Default: 1 (KS1) / 0.6 (KS2)
  seedPolicy?: SeedPolicy     // "random" | "fixed" | "increment"
}
```

### LoraEntry Type
```typescript
{
  id: string                  // Unique ID
  path: string                // "path/to/lora.safetensors"
  weight: number              // 0.00 - 2.00
  enabled: boolean
  source: "preset" | "manual"
  sourceLabel?: string        // Category name
  sourceName?: string         // Preset name
  bindingId?: string          // Groups related LoRAs
  groupBindingId?: string
  suppressed?: boolean        // Soft-deleted
}
```

---

## 🔄 Execution Flow

### Submission Phase
```
runProject/runSection (server action)
  ↓
submitRunToComfyUI()
  ├─ buildComfyPromptDraft(WorkerRunSnapshot)
  ├─ validateComfyPromptDraft() → gets apiPrompt
  ├─ submitComfyPrompt() → POST /prompt
  └─ Return: comfyPromptId
  
Create Run record:
  status=queued
  submittedPrompt=full JSON
  executionMeta=extracted
  comfyPromptId=from response
  
Fire pollRunCompletion(runId) async
```

### Polling Phase
```
pollRunCompletion()
  ├─ waitForPromptToStart() → transitions queued→running
  └─ pollComfyPromptHistory()
      ├─ Extract output images
      ├─ Persist to disk
      ├─ Save workflow.json
      └─ Update status=done
```

---

## 🛠️ Common Tasks

### Find where KSampler defaults are set
→ `src/lib/lora-types.ts:50-67`

### Find where workflow template is loaded
→ `src/server/services/workflow-prompt-builder.ts:142` (buildWorkflowPrompt function)

### Find where seeds are resolved
→ `src/server/services/workflow-prompt-builder.ts:115` (resolveSeed function)

### Find where latent dimensions are calculated
→ `src/server/services/workflow-prompt-builder.ts:156-160` (node 407 setup)

### Find where LoRAs are filled
→ `src/server/services/workflow-prompt-builder.ts:86-112` (fillPowerLoraLoader function)

### Find the execution metadata structure
→ `src/server/services/comfyui-service.ts:229-283` (extractExecutionMeta function)

---

## 🎓 Architecture Summary

**Pattern:** Template → Draft → Workflow JSON → ComfyUI API → Poll → Finalize

**Multi-Stage Processing:**
1. Base generation (KSampler1 @ base resolution)
2. Latent upscale (2x default)
3. Refinement (KSampler2 @ upscaled resolution)
4. VAE decode → pixels
5. Save & metadata capture

**Data Integrity:**
- Full workflow JSON stored for auditability
- Execution metadata extracted for summaries
- workflow.json saved alongside images

**No Latent Caching:** All latent flows through ComfyUI API, no intermediate storage.

---

## 📝 File Count Summary
- **Core files:** 10
- **Total lines analyzed:** ~2000
- **Key findings:** 9 major components
- **Database models involved:** 5 (Project, ProjectSection, Run, Preset, PromptBlock)

---

**Documents Generated:**
- `CODEBASE_ANALYSIS.md` - Detailed 10-section analysis
- `CODEBASE_SUMMARY.md` - Executive summary with findings
- `QUICK_REFERENCE.md` - This file

Last updated: 2026-05-28
