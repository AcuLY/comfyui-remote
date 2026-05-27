# Quick Reference Card - Image Lifecycle

## Image State Machine

```
GENERATION: queued → running → done
                                ↓
REVIEW:     pending → kept (✓)
                  ↘ trashed (✗) [in trash/]
                       ↘ restored → pending
                              ↘ clearTrash() [deleted]
```

## Database Tables at a Glance

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| **Run** | id, projectId, projectSectionId, status, comfyPromptId, outputDir | Generation request & result |
| **ImageResult** | id, runId, filePath, reviewStatus★ | Individual image with review state |
| **TrashRecord** | id, imageResultId, originalPath, trashPath | Audit trail for deleted images |
| **ProjectSection** | id, projectId, latestRunId | Generation config & section metadata |

★ = Core field for review system

## Review Status Values

```
pending   → Initial state, awaiting user decision
kept      → User approved, image is visible
trashed   → User rejected, image moved to trash/
```

## Key Functions & Their Purpose

| Function | File | What It Does |
|----------|------|-------------|
| `submitRunToComfyUI()` | run-executor.ts:147 | Validate & submit prompt to ComfyUI queue |
| `pollRunCompletion()` | run-executor.ts:198 | Poll until ComfyUI execution completes |
| `persistComfyOutputImages()` | image-result-service.ts:300 | Download, compress, store images |
| `keepImages()` | image-review.ts:29 | Mark images as approved (reviewStatus=kept) |
| `trashImages()` | image-review.ts:109 | Mark images as rejected (reviewStatus=trashed) |
| `restoreImage()` | image-review.ts:333 | Restore from trash (reviewStatus=pending) |
| `clearTrash()` | image-review.ts:238 | Permanently delete trashed images |

## File Paths

```
Generated:  data/images/{project}/{section}/run-{id}/raw/NN.jpg
Thumbnail:  data/images/{project}/{section}/run-{id}/thumb/NN.jpg
Workflow:   data/images/{project}/{section}/run-{id}/workflow.json
Trashed:    data/trash/{imageId}/NN.jpg
```

## Common Queries

### Get reviewed images (not trashed)
```typescript
const images = await prisma.imageResult.findMany({
  where: {
    run: { projectSectionId },
    reviewStatus: { not: "trashed" }
  },
  orderBy: { createdAt: "desc" }
});
```

### Get trashed images
```typescript
const trashed = await prisma.imageResult.findMany({
  where: {
    run: { projectSectionId },
    reviewStatus: "trashed"
  },
  include: { trashRecord: true }
});
```

### Get runs with images (not trashed)
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

## Processing Pipeline

```
User Action: runSection()
    ↓
submitRunToComfyUI()
    ├─ Validate prompt
    ├─ Submit to ComfyUI
    └─ Return comfyPromptId
    ↓
Create Run (status=queued)
    ↓
pollRunCompletion() [async background]
    ├─ Wait for start: queued → running
    ├─ Poll until complete
    └─ On success:
    ↓
persistComfyOutputImages()
    ├─ Download from ComfyUI
    ├─ Convert to JPEG (q=90)
    ├─ Generate thumbs (400x400, q=80)
    └─ Atomic write
    ↓
Create ImageResult (reviewStatus=pending)
    ├─ For each image
    └─ filePath, thumbPath, width, height
    ↓
Update Run (status=done)
    ├─ Set outputDir
    ├─ Set finishedAt
    └─ Save workflow.json
    ↓
Gallery Display
    ├─ Show images with reviewStatus != "trashed"
    └─ Buttons: Keep / Trash
    ↓
User Decision
    ├─ keepImages() → reviewStatus = "kept"
    └─ trashImages() → reviewStatus = "trashed" + TrashRecord
```

## What It Does Well ✓

- Individual users generating & reviewing images
- Exploring generation parameters
- Soft-delete with restoration
- Reproducible workflows (saved JSON)
- Concurrent run handling

## What It Doesn't Do ✗

- Multi-person approval workflows
- Role-based permissions
- Quality gates / conditional publish
- Image annotation/feedback
- Approval notifications
- SLA enforcement

## Adding Approval? 

1. Extend `ReviewStatus` enum: add `approved`, `published`
2. Add fields: `isPublished: Boolean`, `approvedAt: DateTime`
3. Add auth: Check `approver` role before approve
4. Add UI: "Approve" button (for reviewers)
5. Add logging: Track approvals in AuditLog

## Performance Notes

- **Atomic writes**: Temp file → rename (prevents partial reads)
- **Fire-and-forget**: Polling is async, doesn't block submission
- **Compression**: All images converted to JPEG for consistency
- **Thumbnails**: 400x400 for fast gallery loading

## Troubleshooting

**Images not appearing?**
- Check `reviewStatus` is not "trashed"
- Verify `filePath` exists in filesystem
- Check Run status is "done"

**Images in wrong state?**
- Query `ImageResult` to see current `reviewStatus`
- Check `TrashRecord` for soft-deleted images
- Look at `createdAt` timestamps to find recent images

**Trashed images not removed?**
- Must call `clearTrash()` explicitly (soft delete)
- `trashImages()` only moves to trash/ folder
- `clearTrash()` needed for permanent deletion

---

**For complete details:** See full documentation in docs/analysis/

| Document | Covers |
|----------|--------|
| 01-IMAGE-LIFECYCLE.md | Complete lifecycle, states, relationships |
| 02-CODE-REFERENCE.md | Code locations, functions, query patterns |
| 03-DATABASE-SCHEMA.md | ER diagrams, data flows, file organization |
