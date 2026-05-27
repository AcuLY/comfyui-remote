# Code Reference Guide - Image Lifecycle

## Key Files & Functions

### 1. RUN EXECUTION & IMAGE GENERATION

**File**: `src/server/services/run-executor.ts`
- **`submitRunToComfyUI(run, options)`** - Submit prompt to ComfyUI queue
  - Line 147-173
  - Returns `SubmitResult` with `comfyPromptId`
  
- **`pollRunCompletion(runId)`** - Poll until run completes
  - Line 198-486
  - Handles state transitions: queued → running → done/failed
  - Calls `persistComfyOutputImages()` on success
  
- **`buildSubmittedRunData(result)`** - Prepare data for Run creation
  - Line 131-140
  - Extracts execution metadata (seeds, steps, cfg, etc.)

### 2. IMAGE PERSISTENCE & STORAGE

**File**: `src/server/services/image-result-service.ts`
- **`persistComfyOutputImages(run, apiUrl, outputImages)`** - Download, compress, persist
  - Line 300-368
  - Creates: `data/images/{project}/{section}/run-{id}/{raw|thumb}/`
  - Downloads from ComfyUI `/view` endpoint
  - Compresses with sharp (JPEG quality=90)
  - Generates 400x400 thumbnails (quality=80)
  - Returns `PersistedRunOutput` with file paths
  
- **`downloadOutputImageBuffer(apiUrl, outputImage)`** - Fetch from ComfyUI
  - Line 165-213
  - With 30s timeout via environment
  
- **`atomicWriteFile(targetPath, data)`** - Safe file write
  - Line 141-163
  - Writes to temp file, then renames
  - Prevents partial reads during concurrent access

### 3. IMAGE REVIEW ACTIONS

**File**: `src/lib/actions/image-review.ts`

- **`keepImages(imageIds)`** - Mark images as approved
  - Line 29-103
  - Sets `reviewStatus = "kept"`, `reviewedAt = now`
  - If in trash: moves file back from trash to original location
  - Updates `TrashRecord.restoredAt`
  
- **`trashImages(imageIds)`** - Mark images as rejected
  - Line 109-203
  - Sets `reviewStatus = "trashed"`, `reviewedAt = now`
  - Moves file from `data/images/` to `data/trash/`
  - Creates/updates `TrashRecord` with original/trash paths
  - Clears project cover if image was cover
  
- **`restoreImage(trashRecordId)`** - Restore from trash
  - Line 333-388
  - Sets `reviewStatus = "pending"`, `reviewedAt = null`
  - Moves file from trash back to original location
  
- **`clearTrash()`** - Permanently delete trashed images
  - Line 238-327
  - Deletes ImageResult and TrashRecord from DB
  - Removes files from disk
  - Clears project cover references

### 4. SECTION & PROJECT MANAGEMENT

**File**: `src/lib/actions/section.ts`
- **`addSection(projectId, name?, folderId?)`** - Create new section
  - Line 49-238
  - Auto-creates PromptBlocks from project preset bindings
  - Sets default generation parameters (aspect ratio, batch size, etc.)
  
- **`clearAllSections(projectId)`** - Delete all sections
  - Line 488-558
  - Cleans up disk files
  - Deletes trashed image records
  - Resets project to draft status

### 5. DATABASE SCHEMA

**File**: `prisma/schema.prisma`

**RunStatus enum** (Line 19-26):
```prisma
enum RunStatus {
  queued
  running
  done
  failed
  cancelled
  paused
}
```

**ReviewStatus enum** (Line 28-32):
```prisma
enum ReviewStatus {
  pending
  kept
  trashed
}
```

**Run model** (Line 430-454):
- Stores generation request and result metadata
- `status`: Current execution state
- `comfyPromptId`: Unique ID in ComfyUI
- `submittedPrompt`: Full JSON workflow
- `executionMeta`: Extracted metadata (seeds, steps, etc.)
- `outputDir`: Where images are stored
- `images`: One-to-many relation to ImageResult

**ImageResult model** (Line 456-475):
- Stores individual image metadata
- `reviewStatus`: pending | kept | trashed
- `filePath`: Current location (raw or trash)
- `thumbPath`: Thumbnail location
- `featured`, `featured2`: User markers
- `reviewedAt`: When user reviewed
- `trashRecord`: Soft-delete tracking

**TrashRecord model** (Line 477-490):
- Audit trail for trashed images
- `originalPath`: Where image was before trash
- `trashPath`: Where image moved to
- `deletedAt`: When trashed
- `restoredAt`: When restored (if applicable)
- `actorType`: user | system | agent

**ProjectSection model** (Line 348-379):
- Configuration for image generation
- `aspectRatio`, `shortSidePx`, `batchSize`: Generation params
- `seedPolicy1`, `seedPolicy2`: Seed behavior
- `ksampler1`, `ksampler2`: K-Sampler parameters
- `loraConfig`: LoRA weights
- `runs`: One-to-many relation to Run
- `latestRunId`: Quick reference to newest run

---

## Data Flow Summary

### Submission Flow
1. User action: `runSection(projectId, sectionId)` (server action)
2. Call `submitRunToComfyUI(run)` → returns `comfyPromptId`
3. Create Run record with `status: "queued"`
4. Fire-and-forget: `pollRunCompletion(runId)`

### Execution Flow
1. `pollRunCompletion()` waits for ComfyUI to start
2. Status: queued → running
3. Poll history endpoint until completion
4. On success: call `persistComfyOutputImages()`
   - Download images from ComfyUI
   - Convert to JPEG
   - Generate thumbnails
   - Write to `data/images/{project}/{section}/run-{id}/`
5. Create ImageResult records for each image
   - `reviewStatus: "pending"` (initial state)
6. Update Run: `status: "done"`

### Review Flow
1. User sees gallery with `reviewStatus != "trashed"`
2. Click keep → `keepImages(imageIds)`
   - `reviewStatus: "kept"`, `reviewedAt: now`
3. Click trash → `trashImages(imageIds)`
   - `reviewStatus: "trashed"`, `reviewedAt: now`
   - Move file to `data/trash/`
   - Create TrashRecord
4. Optional: Click restore in trash bin → `restoreImage(trashRecordId)`
   - `reviewStatus: "pending"`, `reviewedAt: null`
5. Optional: `clearTrash()` to permanently delete

---

## Key Constants & Paths

**Image Storage**:
- Raw images: `data/images/{projectSlug}/{sectionSlug}/run-{runIndex}-{runId}/raw/NN.jpg`
- Thumbnails: `data/images/{projectSlug}/{sectionSlug}/run-{runIndex}-{runId}/thumb/NN.jpg`
- Workflow: `data/images/{projectSlug}/{sectionSlug}/run-{runIndex}-{runId}/workflow.json`
- Trash: `data/trash/{imageResultId}/...`

**Image Processing**:
- Thumbnail max: 400x400 pixels
- JPEG quality (raw): 90
- JPEG quality (thumb): 80
- Atomic write: temp file + rename strategy

**ComfyUI Integration**:
- Timeout for requests: `env.comfyRequestTimeoutMs` (configurable)
- View endpoint: `/view?filename=X&subfolder=Y&type=Z`
- History endpoint: `/history/{prompt_id}`

---

## Query Patterns

**Get completed images (not trashed)**:
```typescript
const images = await prisma.imageResult.findMany({
  where: {
    run: { projectSectionId },
    reviewStatus: { not: "trashed" }  // pending + kept
  }
});
```

**Get trashed images**:
```typescript
const trashed = await prisma.imageResult.findMany({
  where: {
    run: { projectSectionId },
    reviewStatus: "trashed"
  },
  include: { trashRecord: true }
});
```

**Get runs for section**:
```typescript
const runs = await prisma.run.findMany({
  where: { projectSectionId },
  include: {
    images: {
      where: { reviewStatus: { not: "trashed" } }
    }
  },
  orderBy: { createdAt: "desc" }
});
```

---

## Important Notes

1. **No Approval Workflow**: Images go directly from `pending` to `kept` or `trashed`. No multi-stage approval.

2. **Atomic Writes**: Images use temp files + rename to prevent partial reads during serving.

3. **Soft Delete**: TrashRecord stores original path, allowing restore before permanent deletion.

4. **Audit Trail**: TrashRecord includes `deletedAt`, `restoredAt`, and `actorType` for tracking.

5. **Featured Markers**: Two separate flags (`featured`, `featured2`) for special images, but no built-in UI constraints.

6. **Project Cover**: Can have one project cover image, cleared if cover is trashed.

7. **WorkFlow Saved**: Full ComfyUI workflow JSON saved to `{outputDir}/workflow.json` for reproducibility.

