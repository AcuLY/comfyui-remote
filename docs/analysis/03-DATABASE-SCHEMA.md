# Database Schema & Relationships

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌──────────────┐
                          │   Project    │
                          ├──────────────┤
                          │ id (PK)      │
                          │ title        │
                          │ slug         │
                          │ status       │
                          │ coverImageId │
                          └──────┬───────┘
                                 │
                    1:N          │
                                 ▼
                    ┌─────────────────────────────┐
                    │    ProjectSection           │
                    ├─────────────────────────────┤
                    │ id (PK)                     │
                    │ projectId (FK)              │
                    │ name                        │
                    │ sortOrder                   │
                    │ enabled                     │
                    │ aspectRatio                 │
                    │ shortSidePx                 │
                    │ batchSize                   │
                    │ seedPolicy1/2               │
                    │ ksampler1/2 (JSON)          │
                    │ upscaleFactor               │
                    │ loraConfig (JSON)           │
                    │ latestRunId                 │
                    └──────┬──────────────────────┘
                           │
                 1:N        │
                           ▼
              ┌──────────────────────────┐
              │         Run              │
              ├──────────────────────────┤
              │ id (PK)                  │
              │ projectId (FK)           │
              │ projectSectionId (FK)    │
              │ runIndex                 │
              │ status                   │
              │ comfyPromptId            │
              │ submittedPrompt (JSON)   │
              │ executionMeta (JSON)     │
              │ outputDir                │
              │ comfyOutputSubfolder     │
              │ errorMessage             │
              │ startedAt                │
              │ finishedAt               │
              └──────┬───────────────────┘
                     │
           1:N        │
                     ▼
        ┌─────────────────────────────────┐
        │       ImageResult               │
        ├─────────────────────────────────┤
        │ id (PK)                         │
        │ runId (FK)                      │
        │ filePath (UNIQUE)               │◄──────────┐
        │ thumbPath                       │           │
        │ width                           │           │
        │ height                          │           │
        │ fileSize                        │           │
        │ reviewStatus: pending|kept|...  │           │ 1:1 (optional)
        │ featured (Boolean)              │           │
        │ featured2 (Boolean)             │           │
        │ reviewedAt (DateTime)           │───────────┤
        │ createdAt                       │           │
        │ updatedAt                       │           │
        │ trashRecordId (FK, optional)    │           │
        └─────────────────────────────────┘           │
                                                      │
                                    ┌─────────────────┴──────────────┐
                                    │                                │
                          0..1       ▼                                │
                         ┌──────────────────────┐                     │
                         │   TrashRecord        │                     │
                         ├──────────────────────┤                     │
                         │ id (PK)              │                     │
                         │ imageResultId (FK)   │◄────────────────────┘
                         │ originalPath         │  (unique relation)
                         │ trashPath            │
                         │ reason               │
                         │ deletedAt            │
                         │ restoredAt           │
                         │ actorType            │
                         └──────────────────────┘
```

## Key Enums

### RunStatus
```
queued   ──► running ──┬──► done      (✓ success)
                      └──► failed     (✗ error)
      (user can pause/cancel at any point)
```

### ReviewStatus
```
pending  ──┬──► kept     (user approved - visible)
           └──► trashed  (user rejected - moved to trash)

After trash, user can:
  • Restore → pending again
  • Permanently delete via clearTrash()
```

## Data Flow: Complete Journey

```
STEP 1: USER INITIATES RUN
┌──────────────────────────────────┐
│ runSection(projectId, sectionId) │
└──────────┬───────────────────────┘
           │
           ▼
STEP 2: VALIDATE & SUBMIT TO COMFYUI
┌──────────────────────────────────────────────────┐
│ submitRunToComfyUI(run)                          │
│  ├─ Validate ComfyUI prompt                      │
│  ├─ Submit to ComfyUI queue                      │
│  └─ Return comfyPromptId                         │
└──────────┬───────────────────────────────────────┘
           │
           ▼
STEP 3: CREATE RUN RECORD
┌──────────────────────────────────────────────────┐
│ db.run.create({                                  │
│   projectId, projectSectionId, comfyPromptId,   │
│   status: "queued",                              │
│   submittedPrompt: {...},                        │
│   executionMeta: {...}                           │
│ })                                               │
└──────────┬───────────────────────────────────────┘
           │
           ▼
STEP 4: FIRE-AND-FORGET POLLING
┌──────────────────────────────────────────────────┐
│ pollRunCompletion(runId)  [async background]     │
│  ├─ Wait for ComfyUI to start (queued→running)  │
│  ├─ Poll history until execution complete       │
│  └─ On completion:                               │
└──────────┬───────────────────────────────────────┘
           │
           ▼
STEP 5: DOWNLOAD & PROCESS IMAGES
┌──────────────────────────────────────────────────┐
│ persistComfyOutputImages(run, apiUrl, outputs)   │
│  ├─ For each image:                              │
│  │  ├─ Download from ComfyUI /view               │
│  │  ├─ Convert to JPEG (quality=90)              │
│  │  ├─ Generate thumbnail (400x400, q=80)        │
│  │  ├─ Atomic write:                             │
│  │  │   ├─ Write to temp file                    │
│  │  │   └─ Rename to final location              │
│  │  └─ Return: filePath, thumbPath, dimensions   │
│  └─ Cleanup stale files from previous attempts   │
└──────────┬───────────────────────────────────────┘
           │
           ▼
STEP 6: CREATE IMAGE RESULT RECORDS
┌──────────────────────────────────────────────────┐
│ For each image:                                  │
│  db.imageResult.create({                         │
│    runId,                                        │
│    filePath,              ◄──── data/images/...  │
│    thumbPath,                                    │
│    width, height, fileSize,                      │
│    reviewStatus: "pending",                      │
│    featured: false,                              │
│    featured2: false,                             │
│    reviewedAt: null,                             │
│    trashRecord: null                             │
│  })                                              │
└──────────┬───────────────────────────────────────┘
           │
           ▼
STEP 7: MARK RUN COMPLETE
┌──────────────────────────────────────────────────┐
│ completeWorkerRun(runId, completionData)         │
│  ├─ Save workflow.json to outputDir              │
│  ├─ db.run.update({                              │
│  │   status: "done",                             │
│  │   outputDir,                                  │
│  │   finishedAt: now                             │
│  │ })                                            │
│  └─ Update ProjectSection.latestRunId            │
└──────────┬───────────────────────────────────────┘
           │
           ▼
STEP 8: USER REVIEWS IMAGES
┌──────────────────────────────────────────────────┐
│ Gallery displays images with:                    │
│  • reviewStatus != "trashed"                     │
│  • Thumbnail preloading                          │
│  • Keep / Trash buttons per image                │
└──────────┬───────────────────────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
STEP 9A: KEEP    STEP 9B: TRASH
keepImages()     trashImages()
│                │
├─ reviewStatus  ├─ reviewStatus
│  = "kept"      │  = "trashed"
│                │
├─ reviewedAt    ├─ reviewedAt
│  = now         │  = now
│                │
├─ (no change    ├─ Move file to
│  to file)      │  data/trash/
│                │
└─ Visible in    ├─ Create/update
   gallery       │  TrashRecord
                 │
                 ├─ originalPath
                 ├─ trashPath
                 ├─ deletedAt
                 │
                 └─ Not visible in gallery
                    (but visible in trash bin)

     ┌──────────────────────────────────────┐
     │  Optional: restoreImage()            │
     │  (from trash bin)                    │
     │  ├─ Move file back to original path  │
     │  ├─ reviewStatus = "pending"         │
     │  ├─ reviewedAt = null                │
     │  └─ TrashRecord.restoredAt = now     │
     └──────────────────────────────────────┘
            │
            ▼
     ┌──────────────────────────────────────┐
     │  Optional: clearTrash()              │
     │  (permanently delete)                │
     │  ├─ Delete ImageResult from DB       │
     │  ├─ Delete TrashRecord from DB       │
     │  ├─ Delete files from disk           │
     │  └─ Clear project cover refs         │
     └──────────────────────────────────────┘
```

## File System Organization

```
ComfyUI Project Root
├── data/
│   ├── images/                          (Generated image storage)
│   │   ├── project-slug-1/
│   │   │   ├── section-slug-1/
│   │   │   │   ├── run-01-abc123def/
│   │   │   │   │   ├── raw/             (Original compressed JPEGs)
│   │   │   │   │   │   ├── 01.jpg       (1024x1536, ~500KB)
│   │   │   │   │   │   ├── 02.jpg
│   │   │   │   │   │   ├── 03.jpg
│   │   │   │   │   │   └── workflow.json (ComfyUI workflow - for reproducibility)
│   │   │   │   │   └── thumb/           (400x400 thumbnails)
│   │   │   │   │       ├── 01.jpg       (~50KB)
│   │   │   │   │       └── 02.jpg
│   │   │   │   │
│   │   │   │   ├── run-02-xyz789abc/
│   │   │   │   │   └── ...
│   │   │   │
│   │   │   └── section-slug-2/
│   │   │       └── ...
│   │   │
│   │   └── project-slug-2/
│   │       └── ...
│   │
│   └── trash/                           (Soft-deleted images, awaiting permanent deletion)
│       ├── img-123abc/                  (ImageResultId-based folder)
│       │   ├── 01.jpg                   (File moved here when trashed)
│       │   └── 01.jpg.thumb
│       │
│       └── img-456def/
│           └── ...
│
└── prisma/
    └── schema.prisma                    (Database schema definitions)
```

## State Transitions

### Run States
```
         submitted
            ↓
    ┌─────────────┐
    │   queued    │  (waiting in ComfyUI queue)
    └──────┬──────┘
           │ (starts executing)
           ▼
    ┌─────────────┐
    │  running    │  (actively processing in ComfyUI)
    └──────┬──────┘
           │ (completes or fails)
           ├─────────────────┬──────────────────┐
           ▼                 ▼                  ▼
      ┌───────┐         ┌────────┐      ┌──────────┐
      │ done  │         │ failed │      │cancelled │
      └───────┘         └────────┘      └──────────┘
                                             (user action)
           
    Note: Can also transition to "paused" and back at any time
```

### ImageResult Review States
```
    Creation
        ↓
  ┌─────────────┐
  │  pending    │  (initial state - awaiting user review)
  └──┬──────┬───┘
     │      │
     │      └─────────────────────┐
     │                            │
     ▼                            ▼
┌───────────┐              ┌──────────────┐
│   kept    │              │   trashed    │  (moved to trash/)
└───────────┘              └──┬──────┬────┘
     ▲                        │      │
     │                        │      │
     └────────────┐           │      │
                  │ restore   │      │
    (optional)    └──────┬────┘      │
              ┌──────────┴───┐       │
              ▼              │       │ clearTrash()
         ┌──────────┐        │       │
         │ pending  │◄───────┘       │
         └──────────┘                ▼
                             ┌──────────────┐
                             │   deleted    │  (permanent removal)
                             │ (from DB/FS) │
                             └──────────────┘
```

## Query Access Patterns

```
1. Gallery View (not trashed)
   ▼
   SELECT * FROM ImageResult
   WHERE reviewStatus != 'trashed'
   AND run.projectSectionId = ?

2. Trash Bin View (only trashed)
   ▼
   SELECT * FROM ImageResult
   WHERE reviewStatus = 'trashed'
   AND run.projectSectionId = ?
   WITH trashRecord

3. Project Results (all kept images)
   ▼
   SELECT * FROM ImageResult
   WHERE reviewStatus = 'kept'
   AND run.projectId = ?
   ORDER BY run.createdAt DESC

4. Section Results (pending + kept)
   ▼
   SELECT * FROM ImageResult
   WHERE reviewStatus IN ('pending', 'kept')
   AND run.projectSectionId = ?
   ORDER BY run.createdAt DESC

5. Featured Images
   ▼
   SELECT * FROM ImageResult
   WHERE (featured = true OR featured2 = true)
   AND reviewStatus != 'trashed'
   AND run.projectId = ?

6. Project Cover
   ▼
   SELECT i FROM ImageResult i
   WHERE i.id = ?
   (via Project.coverImageId foreign key)
```

