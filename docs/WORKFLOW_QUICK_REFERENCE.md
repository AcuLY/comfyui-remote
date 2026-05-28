# ComfyUI Workflow System - Quick Reference

## 🎯 Three-Tier Architecture

```
┌──────────────────────────────────┐
│  DATABASE (PostgreSQL)           │
│  - Run.resolvedConfigSnapshot    │
│  - Run.submittedPrompt           │
│  - Run.executionMeta             │
│  - ProjectSection config         │
└──────────────────────────────────┘
           ↑ reads ↓ writes
┌──────────────────────────────────┐
│  WORKFLOW BUILDERS               │
│  - buildComfyPromptDraft()       │
│  - buildWorkflowPrompt()         │
│  - extractExecutionMeta()        │
└──────────────────────────────────┘
           ↑ fills ↓ validates
┌──────────────────────────────────┐
│  WORKFLOW TEMPLATE               │
│  docs/workflow.api.json          │
│  - Static node graph             │
│  - Parameterized inputs          │
└──────────────────────────────────┘
```

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `docs/workflow.api.json` | Master workflow template |
| `src/server/services/workflow-prompt-builder.ts` | Node filling logic |
| `src/server/worker/payload-builder.ts` | Prompt draft assembly |
| `src/server/services/comfyui-service.ts` | API submission & polling |
| `src/server/services/run-executor.ts` | Submission orchestration |
| `src/lib/actions/run-execution.ts` | Server actions (entry point) |
| `prisma/schema.prisma` | Database models |

---

## 🔄 Submission Flow (30 seconds)

```
1. runSection(sectionId)
   ↓
2. enqueueProjectSectionRunRepo()
   → Create Run record (status: "queued")
   → Store resolvedConfigSnapshot
   ↓
3. submitRunToComfyUI(run)
   → buildComfyPromptDraft()
   → validateComfyPromptDraft()
   → Load & fill workflow.api.json
   → submitComfyPrompt() → POST /prompt
   ↓
4. Store in DB
   → comfyPromptId
   → submittedPrompt (full graph)
   → executionMeta (seeds, etc.)
   ↓
5. pollRunCompletion() [fire-and-forget]
   → Get results → Update status → Create ImageResults
```

---

## 📊 resolvedConfigSnapshot (Stored in DB)

Every run saves a snapshot at submission time:

```json
{
  "section": {
    "positivePrompt": "...",
    "negativePrompt": "..."
  },
  "parameters": {
    "aspectRatio": "9:16",
    "shortSidePx": 512,
    "batchSize": 1,
    "upscaleFactor": 2.0,
    "checkpointName": "model.safetensors"
  },
  "ksampler1": { "steps": 30, "cfg": 4, "sampler_name": "..." },
  "ksampler2": { "steps": 20, "cfg": 4, "sampler_name": "..." },
  "loraConfig": {
    "lora1": [{ "path": "...", "weight": 0.8, "enabled": true }],
    "lora2": [{ "path": "...", "weight": 0.6, "enabled": true }]
  }
}
```

---

## 🎨 Node Map (workflow.api.json)

| Node | Purpose | Parameters |
|------|---------|------------|
| **1** | CheckpointLoaderSimple | `ckpt_name` |
| **3** | KSampler1 (initial) | `steps`, `cfg`, `sampler_name`, `scheduler`, `seed`, `denoise` |
| **36** | LoRA2 (hires fix) | `lora_1`, `lora_2`, ... |
| **407** | EmptyLatentImage | `width`, `height`, `batch_size` |
| **425** | UpscaleLatent | `width`, `height` |
| **427** | KSampler2 (hires fix) | `steps`, `cfg`, `sampler_name`, `scheduler`, `seed`, `denoise` |
| **511** | Text (positive prompt) | `text` |
| **513** | Text (negative prompt) | `text` |
| **515** | Image Save | `output_path`, `filename_prefix` |
| **522** | LoRA1 (stage 1) | `lora_1`, `lora_2`, ... |

---

## 💾 Data Retention

### Run Model (PostgreSQL)
```prisma
model Run {
  id                    String          @id @default(cuid())
  resolvedConfigSnapshot Json           // ← Config at submission time
  comfyPromptId         String?         // ← ComfyUI prompt ID
  submittedPrompt       Json?           // ← Full workflow graph
  executionMeta         Json?           // ← Actual seeds, steps, etc.
  outputDir             String?
  errorMessage          String?
  status                RunStatus
  startedAt             DateTime?
  finishedAt            DateTime?
}
```

### executionMeta Format
```json
{
  "ks1Seed": 123456,
  "ks1Steps": 30,
  "ks1Cfg": 4,
  "ks2Seed": 654321,
  "ks2Steps": 20,
  "positivePrompt": "full prompt used",
  "negativePrompt": "full negative used",
  "checkpointName": "model.safetensors",
  "lora1": [{ "path": "...", "weight": 0.8 }],
  "lora2": [{ "path": "...", "weight": 0.6 }]
}
```

---

## 🔍 Where to Find Historical Data

### Query Recent Runs
```sql
SELECT id, status, comfyPromptId, submittedPrompt, executionMeta, createdAt
FROM "Run"
WHERE projectId = $1
ORDER BY createdAt DESC
LIMIT 10;
```

### API Endpoint
```
GET /api/runs/{runId}/workflow
→ Returns submittedPrompt as JSON download
```

### React Query
```typescript
// Access via run object in client
run.submittedPrompt  // Full workflow graph
run.executionMeta    // Execution parameters
```

---

## 🎛️ Parameter Filling Examples

### Example 1: Seed Generation
```typescript
// Policy: "random"
seed = Math.floor(Math.random() * 4294967295)

// Policy: "fixed"
seed = 42
```

### Example 2: LoRA Application
```typescript
// Input from loraConfig
[{ path: "style/cinematic.safetensors", weight: 0.8, enabled: true }]

// Fills node 522 inputs as:
{
  lora_1: {
    on: true,
    lora: "style/cinematic.safetensors",
    strength: 0.8
  }
}
```

### Example 3: Hires Fix Conditional
```typescript
if (upscaleFactor === 1) {
  // Delete nodes 425, 427, 36
  // Rewire 410 → 3 (KSampler1)
} else {
  // Keep all nodes
  // Fill node 425 with upscale dimensions
}
```

---

## 🚀 Custom Workflow Override

Store in `ProjectSection.extraParams`:

```json
{
  "extraParams": {
    "comfyPrompt": {
      "1": { "inputs": { "ckpt_name": "custom.safetensors" }, "class_type": "CheckpointLoaderSimple" },
      "3": { "inputs": { "steps": 50, "cfg": 7 }, "class_type": "KSampler" }
    }
  }
}
```

Priority:
1. Custom `comfyPrompt` in extraParams
2. Standard `workflow.api.json`
3. Fallback SDXL builder

---

## 📈 Database Relationships

```
Project
  └─ ProjectSection (positivePrompt, negativePrompt, ksampler1, etc.)
     └─ PromptBlock[] (modular prompt components)
        └─ Run[] (status, resolvedConfigSnapshot, submittedPrompt, executionMeta)
           └─ ImageResult[] (filePath, width, height, etc.)
```

---

## 🔗 ComfyUI API Calls

### 1. Submit Workflow
```
POST /prompt
{
  "prompt": { /* full node graph */ },
  "client_id": "run-{runId}",
  "extra_data": { /* metadata */ }
}
→ { "prompt_id": "abc123", "node_errors": {} }
```

### 2. Check Status
```
GET /queue
→ { "queue_running": [...], "queue_pending": [...] }
```

### 3. Poll Results
```
GET /history/{prompt_id}
→ { "{prompt_id}": { "outputs": {...}, "status": {...} } }
```

---

## 🧪 Quick Debug Checklist

- [ ] Is `docs/workflow.api.json` valid JSON? (263 lines)
- [ ] Does `resolvedConfigSnapshot` have all required fields?
- [ ] Is `submittedPrompt` a deep clone of the template?
- [ ] Are `ksampler1`/`ksampler2` nodes being filled?
- [ ] Are LoRAs being converted to Power Lora Loader format?
- [ ] Is `outputPath` normalized with forward slashes?
- [ ] Is `comfyPromptId` present before polling?
- [ ] Are seeds within `[0, 4294967295]` range?

---

## 📚 Related Documentation

- [`WORKFLOW_SYSTEM_ANALYSIS.md`](./WORKFLOW_SYSTEM_ANALYSIS.md) - Comprehensive deep dive
- [`quick-reference.md`](./quick-reference.md) - General system overview
- `src/server/services/comfyui-service.ts` - Service implementation

