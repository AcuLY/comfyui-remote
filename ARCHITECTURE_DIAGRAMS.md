# ComfyUI Remote - Architecture Diagrams

## 1. Workflow Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ProjectSection (Database Template)                          │
│ ├─ ksampler1: KSamplerParams                               │
│ ├─ ksampler2: KSamplerParams                               │
│ ├─ loraConfig: { lora1: [], lora2: [] }                    │
│ ├─ positivePrompt, negativePrompt                          │
│ └─ upscaleFactor, checkpointName, etc.                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ buildComfyPromptDraft()                                     │
│ (payload-builder.ts)                                        │
│ Creates intermediate ComfyPromptDraft                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ buildWorkflowPrompt()                                       │
│ (workflow-prompt-builder.ts)                                │
│ ├─ Deep-clone docs/workflow.api.json                       │
│ └─ Fill with parameters → Complete API JSON               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Full ComfyUI Workflow JSON (14 Nodes)                       │
│ Ready for submission                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ submitComfyPrompt() + validateComfyPromptDraft()           │
│ (comfyui-service.ts)                                        │
│ POST /prompt → Get comfyPromptId                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Store in Database Run Record:                               │
│ ├─ submittedPrompt: Full JSON                              │
│ ├─ comfyPromptId: Response ID                              │
│ ├─ executionMeta: Extracted metadata                       │
│ ├─ status: queued                                          │
│ └─ resolvedConfigSnapshot: Full config                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
    Sync: Return to UI    Async: pollRunCompletion()
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │ Poll ComfyUI Queue/History  │
                    │ Every 2 seconds              │
                    ├─ Extract images             │
                    ├─ Persist to disk            │
                    ├─ Save workflow.json         │
                    └─ Update Run.status = done   │
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │ Final Run Record Complete    │
                    │ ├─ submittedPrompt (stored) │
                    │ ├─ executionMeta (stored)   │
                    │ ├─ outputDir (path)         │
                    │ └─ ImageResult[] (refs)     │
                    └─────────────────────────────┘
```

---

## 2. ComfyUI Workflow Graph (14 Nodes)

```
STAGE 1: BASE GENERATION
┌──────────────────────────────────────────────────────────┐
│ Node 1: Checkpoint Loader                               │
│ ├─ Output[0]: model                                     │
│ ├─ Output[1]: clip                                      │
│ └─ Output[2]: vae                                       │
└────┬──────────┬──────────────────────┬──────────────────┘
     │          │                      │
     ▼          ▼                      ▼
┌────────┐ ┌────────┐ ┌──────────────────────┐
│ Node 3 │ │Node 522│ │  Node 407            │
│KSampler│ │ LoRA1  │ │EmptyLatentImage      │
│        │ │        │ │ ├─ width, height     │
│        │ │        │ │ └─ batch_size        │
└────┬───┘ └───┬────┘ └──────────┬───────────┘
     │         │                  │
     │    ┌────▼────┐       ┌─────▼──────┐
     │    │  Node 4 │       │  Node 12   │
     │    │CLIP Enc │       │CLIP Enc    │
     │    │Positive │       │Negative    │
     │    └────┬────┘       └─────┬──────┘
     │         │                  │
     └─────────┼──────────────────┘
               │
               ▼
         ┌──────────┐
         │ Node 510 │ ← Prompts
         │TextInput │
         └──────────┘

LATENT FLOW (KSampler1 Output):
     │
     ▼
┌────────────────────────────────────────────────────┐
│ IF upscaleFactor > 1 (Hires Fix):                 │
│                                                   │
│ Node 425: LatentUpscale                           │
│ ├─ Input: latent from KSampler1                   │
│ ├─ Output: upscaled latent (2x default)           │
│ └─ Rounded to 8-pixel boundaries                  │
│                                                   │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│ STAGE 2: REFINEMENT (IF upscaleFactor > 1)         │
│                                                   │
│ Node 427: KSampler2                               │
│ ├─ Input: Upscaled latent from 425                │
│ ├─ Model: LoRA2 (node 36)                         │
│ ├─ Positive: Node 519 (CLIP Encoded)              │
│ ├─ Negative: Node 520 (CLIP Encoded)              │
│ ├─ Steps: 30 (default)                            │
│ ├─ CFG: 7 (default)                               │
│ └─ Denoise: 0.6 (inpaint/refinement mode)         │
│                                                   │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│ Node 410: VAE Decode                               │
│ ├─ Input: Latent (from KS2 or KS1 if no upscale) │
│ ├─ VAE: From checkpoint (node 1, slot 2)          │
│ └─ Output: Pixel image                            │
│                                                   │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│ Node 515: Image Save                               │
│ ├─ Input: Pixel image from VAE Decode             │
│ ├─ output_path: "${projectId}/${sectionId}"       │
│ ├─ filename_prefix: runId (collision avoidance)   │
│ └─ Output: PNG files saved to disk                │
└────────────────────────────────────────────────────┘
```

---

## 3. KSampler Configuration Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│ KSampler Parameters                                             │
├───────────────────┬──────────────────────┬──────────────────────┤
│ Parameter         │ KSampler1            │ KSampler2            │
│                   │ (Base Generation)    │ (Hires Refinement)   │
├───────────────────┼──────────────────────┼──────────────────────┤
│ Node ID           │ 3                    │ 427                  │
│ Resolution        │ Base (e.g., 512px)   │ Upscaled (e.g., 1k)  │
│ LoRA Source       │ Node 522             │ Node 36              │
│ Input Latent      │ Node 407             │ Node 425 (upscaled)  │
├───────────────────┼──────────────────────┼──────────────────────┤
│ steps (default)   │ 30                   │ 30                   │
│ cfg (default)     │ 4                    │ 7                    │
│ sampler_name      │ "euler_ancestral"    │ "dpmpp_2m"           │
│ scheduler         │ "karras"             │ "karras"             │
│ denoise (default) │ 1.0                  │ 0.6                  │
│ seedPolicy        │ "random"             │ "random"             │
├───────────────────┼──────────────────────┼──────────────────────┤
│ Purpose           │ Broad generation     │ Detail refinement    │
│ Quality Focus     │ Overall composition  │ Fine details         │
│ Active If         │ Always               │ upscaleFactor > 1    │
└───────────────────┴──────────────────────┴──────────────────────┘

Seed Resolution:
┌────────────────────────────────────────────────────────┐
│ Policy: "random" → Math.floor(Math.random() * 2^32-1) │
│ Policy: "fixed"  → Always 42                          │
│ Policy: "increment" → Falls through to "random"       │
│ (No cross-run seed tracking)                          │
│                                                      │
│ Result: Actual seed stored in executionMeta for      │
│ reproducibility without modifying template config    │
└────────────────────────────────────────────────────────┘
```

---

## 4. Database Storage Model

```
┌─────────────────────────────────────────────────────────────────┐
│ Run Record (Prisma)                                             │
├─────────────────────────────────────────────────────────────────┤
│ PRIMARY CONTENT:                                                │
│                                                                 │
│ submittedPrompt: Json                                           │
│ ├─ Complete ComfyUI workflow JSON                              │
│ ├─ All 14 nodes with their inputs populated                    │
│ └─ Stored for auditability + reproducibility                   │
│                                                                 │
│ executionMeta: Json                                            │
│ ├─ KSampler1: ks1Seed, ks1Steps, ks1Cfg, ks1Sampler,          │
│ │            ks1Scheduler, ks1Denoise                          │
│ ├─ KSampler2: ks2Seed, ks2Steps, ks2Cfg, ks2Sampler,          │
│ │            ks2Scheduler, ks2Denoise                          │
│ ├─ Config: positivePrompt, negativePrompt, aspectRatio,        │
│ │          shortSidePx, batchSize, upscaleFactor,              │
│ │          checkpointName                                      │
│ └─ LoRA: lora1[], lora2[] (with path, weight, enabled)         │
│                                                                 │
│ resolvedConfigSnapshot: Json                                   │
│ └─ Full configuration state at submission (for debugging)      │
│                                                                 │
│ EXECUTION TRACKING:                                            │
│                                                                 │
│ status: RunStatus                                              │
│ ├─ "queued" → waiting in ComfyUI queue                         │
│ ├─ "running" → ComfyUI is executing                            │
│ ├─ "done" → completed successfully                             │
│ ├─ "failed" → execution error                                  │
│ ├─ "cancelled" → user stopped                                  │
│ └─ "paused" → user paused                                      │
│                                                                 │
│ comfyPromptId: String?                                         │
│ └─ ComfyUI's internal prompt ID (for queue/history lookup)     │
│                                                                 │
│ OUTPUT TRACKING:                                               │
│                                                                 │
│ outputDir: String?                                             │
│ ├─ Server path to output images                                │
│ ├─ Also contains workflow.json for reference                   │
│ └─ Example: "output/run-12345"                                 │
│                                                                 │
│ comfyOutputSubfolder: String?                                  │
│ └─ ComfyUI's subfolder within outputDir                        │
│                                                                 │
│ images: ImageResult[]                                          │
│ ├─ Foreign key reference                                       │
│ └─ Links to saved image files with metadata                    │
│                                                                 │
│ TIMING:                                                        │
│                                                                 │
│ startedAt: DateTime?                                           │
│ ├─ When ComfyUI started executing (not submission time)        │
│ └─ Set when status transitions to "running"                    │
│                                                                 │
│ finishedAt: DateTime?                                          │
│ └─ When execution completed (success or failure)               │
│                                                                 │
│ ADMINISTRATIVE:                                                │
│                                                                 │
│ errorMessage: String? (if status = "failed")                   │
│ createdAt: DateTime (submission time)                          │
│ updatedAt: DateTime (last modification)                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ProjectSection Record (Template)                                 │
├──────────────────────────────────────────────────────────────────┤
│ ksampler1: Json (KSamplerParams for stage 1)                    │
│ ksampler2: Json (KSamplerParams for stage 2)                    │
│ upscaleFactor: Float (1, 1.5, 2, 2.5, 3)                        │
│ loraConfig: Json ({ lora1: [], lora2: [] })                     │
│ positivePrompt: String?                                         │
│ negativePrompt: String?                                         │
│ checkpointName: String?                                         │
│ aspectRatio: String? (e.g., "16:9")                             │
│ shortSidePx: Int? (e.g., 512)                                   │
│ batchSize: Int?                                                 │
│ promptBlocks: PromptBlock[] (array of prompt components)        │
│ runs: Run[] (all runs from this section)                        │
│ latestRunId: String? (reference to most recent run)             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow: Request → Execution → Storage

```
┌─────────────────────────────────────────────────────────────────┐
│ USER REQUEST                                                    │
│ "Run project XYZ, section ABC"                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. READ CONFIG FROM DB                                          │
│ └─ ProjectSection ABC: ksampler1, ksampler2, loraConfig,        │
│    prompts, upscaleFactor, checkpointName, etc.                 │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. BUILD INTERMEDIATE DRAFT                                     │
│ └─ buildComfyPromptDraft(WorkerRunSnapshot)                     │
│    → ComfyPromptDraft (not yet workflow JSON)                   │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FILL WORKFLOW TEMPLATE                                       │
│ └─ buildWorkflowPrompt()                                        │
│    ├─ Deep-clone docs/workflow.api.json                         │
│    ├─ Populate each node's inputs                               │
│    └─ Return: Complete API JSON (14 nodes)                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. VALIDATE & SUBMIT                                            │
│ ├─ validateComfyPromptDraft() (pre-flight check)                │
│ ├─ submitComfyPrompt() (POST /prompt)                           │
│ ├─ Response: comfyPromptId                                      │
│ └─ Extract: executionMeta (seeds, params)                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. STORE IN DATABASE                                            │
│ └─ Create Run record:                                           │
│    ├─ status = "queued"                                         │
│    ├─ submittedPrompt = full JSON workflow                      │
│    ├─ executionMeta = extracted metadata                        │
│    ├─ comfyPromptId = response ID                               │
│    └─ resolvedConfigSnapshot = full config                      │
└────────────┬────────────────────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
   SYNC             ASYNC
  Return            pollRunCompletion(runId)
   to UI            │
                    ▼
            ┌───────────────────────────┐
            │ POLL COMFYUI (every 2s)   │
            ├───────────────────────────┤
            │ waitForPromptToStart()     │
            │ → status: queued→running   │
            │ → Set startedAt            │
            └───────┬───────────────────┘
                    │
                    ▼
            ┌───────────────────────────┐
            │ POLL HISTORY              │
            │ pollComfyPromptHistory()  │
            │ → Extract images          │
            │ → Get output location     │
            └───────┬───────────────────┘
                    │
                    ▼
            ┌───────────────────────────┐
            │ PERSIST TO DISK           │
            │ ├─ Save images            │
            │ ├─ Save workflow.json     │
            │ └─ Create ImageResult[]   │
            └───────┬───────────────────┘
                    │
                    ▼
            ┌───────────────────────────┐
            │ UPDATE RUN RECORD         │
            │ ├─ status = "done"        │
            │ ├─ outputDir = path       │
            │ ├─ finishedAt = now()     │
            │ └─ images = refs[]        │
            └───────────────────────────┘
```

---

## 6. LoRA Two-Stage Application

```
ProjectSection.loraConfig
├─ lora1: LoraEntry[]
│  ├─ { path: "char/miku.safetensors", weight: 1.0, enabled: true }
│  └─ { path: "style/anime.safetensors", weight: 0.8, enabled: true }
│
└─ lora2: LoraEntry[]
   ├─ { path: "style/cinematic.safetensors", weight: 0.7, enabled: true }
   └─ { path: "detail/fine.safetensors", weight: 0.5, enabled: true }

                          │
                          ▼

FILL WORKFLOW:
┌──────────────────────────────────────────────────────────────┐
│ Node 522 (Power Lora Loader 1)                               │
│ ├─ model: ["1", 0] (checkpoint)                              │
│ ├─ clip: ["1", 1]                                            │
│ ├─ lora_1: { on: true, lora: "char/miku.safetensors",        │
│ │           strength: 1.0 }                                  │
│ └─ lora_2: { on: true, lora: "style/anime.safetensors",      │
│            strength: 0.8 }                                   │
│                                                              │
│ Output[0] → model for Node 3 (KSampler1)                     │
│ Output[1] → clip for text encoding (Nodes 4, 12)             │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
                    Node 3: KSampler1
                  (Generate at base res)
                          │
                          ▼
                  Node 407: EmptyLatentImage
                          │
                          ▼
                    Node 425: LatentUpscale
                       (2x default)
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Node 36 (Power Lora Loader 2)                                │
│ ├─ model: ["1", 0] (checkpoint)                              │
│ ├─ clip: ["1", 1]                                            │
│ ├─ lora_1: { on: true, lora: "style/cinematic.safetensors",  │
│ │           strength: 0.7 }                                  │
│ └─ lora_2: { on: true, lora: "detail/fine.safetensors",      │
│            strength: 0.5 }                                   │
│                                                              │
│ Output[0] → model for Node 427 (KSampler2)                   │
│ Output[1] → clip for text encoding (Nodes 519, 520)          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
                  Node 427: KSampler2
                (Refine at upscaled res)
                          │
                          ▼
                  Node 410: VAEDecode
                          │
                          ▼
                  Node 515: ImageSave

RESULT:
- Stage 1: Character (miku) + anime style applied
- Stage 2: Cinematic style + fine details applied on upscaled latent
- Final: High-quality image with layered aesthetic
```

---

**Diagrams explain:**
1. Full workflow pipeline from database to final output
2. ComfyUI graph structure with 14 nodes
3. KSampler parameter differences between stages
4. Database storage for complete audit trail
5. Complete request→execution→storage flow
6. LoRA two-stage application architecture

