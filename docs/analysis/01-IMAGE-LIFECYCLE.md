# ComfyUI Management System - Image Lifecycle Analysis

## Overview
This document details the complete lifecycle of images in the ComfyUI management system, from generation through storage, review, and display.

---

## 1. IMAGE GENERATION FLOW (Run Execution)

### Submission Phase (`run-executor.ts`)

**Function**: `submitRunToComfyUI(run, options)`
- **Input**: `WorkerRunSnapshot` containing project, section, and workflow config
- **Process**:
  1. Build ComfyUI prompt draft from run configuration
  2. Validate prompt against ComfyUI API
  3. Submit prompt to ComfyUI queue
  4. Return `SubmitResult` with `comfyPromptId` and validated prompt
- **Output**: Run is created in DB with status=`queued`
- **Key Data**: `comfyPromptId`, `submittedPrompt` (full workflow JSON), `executionMeta` (seeds, cfg, steps)

### Polling & Execution Phase (`run-executor.ts`)

**Function**: `pollRunCompletion(runId)`
- **Duration**: Fire-and-forget from server action, polls continuously until completion
- **State Transitions**:
  1. `queued` → Poll ComfyUI until prompt starts
  2. `running` → Poll history endpoint until completion
  3. `done` (success) or `failed` (error)

### Output Processing Phase (`image-result-service.ts`)

**Function**: `persistComfyOutputImages(run, apiUrl, outputImages)`
- **Input**: ComfyUI output image list with filename, subfolder, type
- **Steps**:
  1. **Create directory structure**: `data/images/{projectSlug}/{sectionSlug}/run-{runIndex}-{runId}/{raw|thumb}`
  2. **Download images**: Fetch from ComfyUI `/view` endpoint
  3. **Compress**: Convert to JPEG with quality=90 using sharp
  4. **Generate thumbnails**: 400x400 max dimension, quality=80
  5. **Atomic write**: Write to temp file then rename (prevents partial reads)
  6. **Cleanup**: Remove stale files from previous attempts

- **Output**: `PersistedRunOutput` containing:
  ```typescript
  {
    outputDir: "data/images/project-slug/section-slug/run-01-xxx/raw"
    images: [
      {
        filePath: "data/images/.../raw/01.jpg",
        thumbPath: "data/images/.../thumb/01.jpg",
        width: 1024,
        height: 1536,
        fileSize: 524288n
      },
      // ... more images
    ]
  }
  ```

### Completion Phase (`run-executor.ts`)

**Function**: `completeWorkerRun(runId, completionData)`
- **Status Update**: Run status → `done`
- **Finalization**: 
  - Save workflow JSON to output directory
  - Create `ImageResult` records for each image
  - Update Run with output metadata

---

## 2. IMAGE STORAGE & DATABASE SCHEMA

### Run Model
```prisma
model Run {
  id                   String          // UUID
  projectId            String          // FK to Project
  projectSectionId     String          // FK to ProjectSection
  status               RunStatus       // queued | running | done | failed | cancelled | paused
  comfyPromptId        String?         // Unique ID from ComfyUI
  submittedPrompt      Json?           // Full workflow JSON
  executionMeta        Json?           // { ks1Seed, ks2Seed, ks1Steps, ks1Cfg, ... }
  outputDir            String?         // "data/images/.../raw" - relative path
  comfyOutputSubfolder String?         // ComfyUI output subfolder if specified
  images               ImageResult[]   // One-to-many relation
  errorMessage         String?         // If failed
  startedAt            DateTime?
  finishedAt           DateTime?
}
```

### ImageResult Model (THE CORE REVIEW/APPROVAL CONCEPT)
```prisma
enum ReviewStatus {
  pending               // Initial state - awaiting user review
  kept                  // User approved - show in results
  trashed               // User rejected - move to trash
}

model ImageResult {
  id              String          // UUID
  runId           String          // FK to Run
  filePath        String          @unique  // Current path (raw or trash)
  thumbPath       String?         // Thumbnail path
  width           Int?
  height          Int?
  fileSize        BigInt?
  
  // REVIEW STATE
  reviewStatus    ReviewStatus    @default(pending)
  featured        Boolean         @default(false)  // Starred by user
  featured2       Boolean         @default(false)  // Double starred
  reviewedAt      DateTime?       // When reviewed
  
  trashRecord     TrashRecord?    // Only if reviewStatus == trashed
  createdAt       DateTime
  updatedAt       DateTime
}

model TrashRecord {
  id              String          @unique
  imageResultId   String          @unique  // FK to ImageResult
  originalPath    String          // Where image was before trash
  trashPath       String          // Where image is moved to (data/trash/...)
  reason          String?
  deletedAt       DateTime
  restoredAt      DateTime?       // If user restores from trash
  actorType       ActorType       // user | system | agent
}
```

### ProjectSection Model (RELATES RUNS TO SECTIONS)
```prisma
model ProjectSection {
  id              String
  projectId       String          // FK to Project
  name            String?
  sortOrder       Int
  enabled         Boolean
  
  // Generation parameters
  aspectRatio     String?         // e.g., "2:3"
  shortSidePx     Int?            // e.g., 512
  batchSize       Int?
  seedPolicy1     String?
  seedPolicy2     String?
  ksampler1       Json?           // KSampler parameters
  ksampler2       Json?
  upscaleFactor   Float?
  
  // Content
  positivePrompt  String?
  negativePrompt  String?
  loraConfig      Json?
  promptBlocks    PromptBlock[]
  
  // Output tracking
  latestRunId     String?
  runs            Run[]
}
```

---

## 3. IMAGE LIFECYCLE STATES

```
GENERATION PHASE
  ↓
Run Status: queued → running → done
                            ↓
IMAGE RESULT CREATED (initial reviewStatus = "pending")
                            ↓
USER REVIEW PHASE
  ├─ keepImages() → reviewStatus = "kept" + reviewedAt = now
  ├─ trashImages() → reviewStatus = "trashed" + TrashRecord created
  └─ restoreImage() → reviewStatus = "pending" + TrashRecord.restoredAt = now
                            ↓
DATA DISPLAY
  ├─ Results Gallery: Shows pending + kept (filters out trashed)
  ├─ Trash Bin: Shows only trashed images
  ├─ Featured: Shows images with featured=true
  └─ Cover: One image marked as project cover
```

---

## 4. REVIEW/APPROVAL SYSTEM

### Core Concept: Review Status Workflow

**NO formal approval workflow** exists. Instead:
- **Simple 3-state model**: `pending` → `kept` | `trashed`
- **User-driven actions**: Keep/trash buttons in gallery
- **No role-based approval**: All users can review

### Review Actions (image-review.ts)

#### `keepImages(imageIds)`
- **Before**: Any state (pending, trashed, or pending)
- **After**: `reviewStatus = "kept"`, `reviewedAt = now`
- **If restored from trash**: Move file from trash back to original location
- **Side effect**: If image was in trash, `TrashRecord.restoredAt = now`

#### `trashImages(imageIds)`
- **Before**: Any state (pending or kept)
- **After**: `reviewStatus = "trashed"`, `reviewedAt = now`
- **File operation**: Move image from `data/images/` to `data/trash/`
- **DB operation**: Create/update `TrashRecord` with `originalPath`, `trashPath`
- **Side effect**: If image is project cover, clear `Project.coverImageId`

#### `restoreImage(trashRecordId)`
- **Before**: `reviewStatus = "trashed"`, `restoredAt = null`
- **After**: `reviewStatus = "pending"`, `reviewedAt = null`
- **File operation**: Move image from trash path back to original path

#### `clearTrash()`
- **Before**: All trashed images with `restoredAt = null`
- **After**: ImageResult and TrashRecord deleted, files removed from disk
- **Cascade**: Also clears any project cover references

### Image Filtering in Queries

Most image displays use this filter pattern:
```typescript
// Show in results gallery
where: {
  run: { projectSectionId },
  reviewStatus: { not: "trashed" }  // pending + kept
}

// Show in trash bin
where: {
  run: { projectSectionId },
  reviewStatus: "trashed"
}
```

---

## 5. IMAGE SERVING & DISPLAY

### Directory Structure

```
data/
├── images/                              # All generated images
│   ├── {projectSlug}/
│   │   └── {sectionSlug}/
│   │       └── run-01-{runId}/
│   │           ├── raw/                 # Original compressed JPEGs
│   │           │   ├── 01.jpg
│   │           │   ├── 02.jpg
│   │           │   └── workflow.json    # Saved ComfyUI workflow
│   │           └── thumb/               # Thumbnails (400x400)
│   │               ├── 01.jpg
│   │               └── 02.jpg
│   └── ...
└── trash/                               # Trashed images (before permanent deletion)
    ├── {imageResultId}/
    │   ├── 01.jpg
    │   └── 01.jpg.thumb
    └── ...
```

### How Images Are Displayed

**Gallery Component** (`results-gallery.tsx`):
- Fetches image list with `src` (thumbnail) and `full` (original)
- Shows images with `reviewStatus != "trashed"`
- Preloads next images async
- On user action: Call `keepImages()` or `trashImages()`

**Image Fetch Route** (`/api/images/`):
- Serves images from `filePath` and `thumbPath`
- Atomic writes ensure no partial reads

---

## 6. KEY FINDINGS: APPROVAL/REVIEW CONCEPTS

### ✅ What EXISTS
1. **Binary Review Status**: `pending` → `kept` or `trashed`
2. **User-Driven Actions**: Manual keep/trash in gallery
3. **Trash System**: Soft delete with restoration capability
4. **Audit Trail**: `TrashRecord` tracks who deleted and when
5. **Featured Markers**: `featured` and `featured2` flags for special images
6. **Cover Image**: Project can have one cover image
7. **Timestamp Tracking**: `reviewedAt` records when reviewed

### ❌ What DOESN'T EXIST
1. **Approval Workflow**: No multi-stage approval (e.g., reviewer → approver → publisher)
2. **Role-Based Permissions**: No concept of "image approver" vs "image creator" roles
3. **Post-Processing**: No image modification/annotation before keeping
4. **Quality Scoring**: No automated quality metrics or filtering
5. **Conditional Logic**: No rules like "all images must have kept >= N% before publishing"
6. **Notification System**: No approver notifications or review queues

---

## 7. SECTION-RUN-IMAGE RELATIONSHIPS

```
Project
  └── ProjectSection (multiple)
       └── Run (multiple) - one per generation
            └── ImageResult (multiple) - one per output image
                 └── TrashRecord (optional) - if trashed
```

### Key Relationships

| Entity | Relation | Purpose |
|--------|----------|---------|
| Run | FK to ProjectSection | Groups images by section |
| Run | FK to Project | Track project-level stats |
| ImageResult | FK to Run | Track which run generated image |
| TrashRecord | FK to ImageResult | Track trash history |
| ProjectSection | latestRunId (optional) | Quick reference to newest run |

### How They Connect

1. **User requests run in section** → Creates Run record with section ID
2. **ComfyUI completes run** → pollRunCompletion fetches images
3. **Images downloaded** → persistComfyOutputImages creates ImageResult records
4. **Each ImageResult** → Links back to Run → Links to ProjectSection → Links to Project
5. **User reviews** → keepImages/trashImages updates ReviewStatus
6. **Results displayed** → Query by ProjectSection with `reviewStatus != "trashed"`

---

## 8. IMAGE LIFECYCLE COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER TRIGGERS RUN                                        │
│    runSection(projectId, sectionId) server action           │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SUBMIT TO COMFYUI                                        │
│    submitRunToComfyUI(run)                                  │
│    → Validate prompt                                        │
│    → Submit to ComfyUI queue                                │
│    → Get comfyPromptId                                      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CREATE RUN RECORD                                        │
│    db.run.create({                                          │
│      projectId, projectSectionId, comfyPromptId,            │
│      status: "queued", submittedPrompt, executionMeta       │
│    })                                                       │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. POLL FOR COMPLETION (fire-and-forget)                   │
│    pollRunCompletion(runId)                                 │
│    → Wait for prompt to start (queued → running)            │
│    → Poll history until execution completes                 │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. PERSIST IMAGES                                           │
│    persistComfyOutputImages(run, apiUrl, outputImages)      │
│    → For each image:                                        │
│      • Download from ComfyUI                                │
│      • Convert to JPEG (quality=90)                         │
│      • Generate thumbnail (400x400, quality=80)             │
│      • Atomic write to: data/images/.../raw/NN.jpg         │
│    → Return PersistedRunOutput with paths                   │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. CREATE IMAGE RECORDS                                     │
│    completeWorkerRun(runId, completionData)                 │
│    For each image: db.imageResult.create({                  │
│      runId, filePath, thumbPath, width, height,             │
│      fileSize, reviewStatus: "pending", featured: false     │
│    })                                                       │
│    Update Run: status = "done", outputDir, images[]         │
│    Save workflow.json to outputDir                          │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. IMAGES READY FOR REVIEW                                  │
│    State: ImageResult.reviewStatus = "pending"              │
│    User sees images in results gallery                      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
         ┌─────────┴──────────┐
         ↓                    ↓
    ┌────────────┐    ┌───────────────┐
    │ keepImages │    │ trashImages   │
    └────┬───────┘    └───────┬───────┘
         ↓                    ↓
   reviewStatus         reviewStatus
   = "kept"             = "trashed"
   reviewedAt = now     reviewedAt = now
   (file stays)         (file → trash/
                         TrashRecord created
         ↓                    ↓
    ┌────────────────────────────────┐
    │ clearTrash (optional)           │
    │ → Delete ImageResult + files    │
    └────────────────────────────────┘
         ↓
    ┌────────────────────────────────┐
    │ FINAL STATE                     │
    │ Kept images: visible in gallery │
    │ Trashed: removed from disk      │
    └────────────────────────────────┘
```

---

## Summary

The image lifecycle is **relatively simple**:

1. **Generation**: ComfyUI produces images, run-executor downloads and compresses them
2. **Storage**: Images stored at `data/images/{project}/{section}/run-{id}/{raw|thumb}/`
3. **Review**: Users manually mark images as `kept` or `trashed` (no approval workflow)
4. **Display**: Gallery shows only non-trashed images
5. **Cleanup**: Users can permanently delete trashed images with `clearTrash()`

**Key Insight**: There's a **review system** (pending → kept/trashed) but **NO approval workflow**. All users can review, and there's no concept of staged approval or role-based review.

