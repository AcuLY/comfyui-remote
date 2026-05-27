# ComfyUI Image Lifecycle Documentation

**Last Updated:** 2026-05-27  
**Status:** ✓ Complete analysis of image generation, storage, review, and display

## 📋 Quick Answer

**Question:** How do images flow through this system?

**Answer:** 
1. User triggers run → ComfyUI generates images
2. System downloads & compresses images to `data/images/`
3. Images marked as `reviewStatus: "pending"`
4. User can keep (→ "kept") or trash (→ "trashed")
5. Trashed images moved to `data/trash/` (soft delete)
6. User can restore or permanently delete

**Approval Concept:** There's a **review system** (pending/kept/trashed) but **NO approval workflow** (no multi-stage approval, roles, or gating).

---

## 📚 Full Documentation

Complete analysis has been generated in `/docs/analysis/`:

### 1. **[QUICK-REFERENCE.md](./docs/analysis/QUICK-REFERENCE.md)** ⭐ START HERE
- State machine diagram
- Database tables summary
- Key functions at a glance
- Common queries
- Processing pipeline
- Troubleshooting tips

### 2. **[01-IMAGE-LIFECYCLE.md](./docs/analysis/01-IMAGE-LIFECYCLE.md)** - Complete Lifecycle
- Image generation flow (8 steps)
- Image storage & database schema
- Image lifecycle states
- Review/approval system
- Image serving & display
- Key findings about approval concepts
- Section-run-image relationships

### 3. **[02-CODE-REFERENCE.md](./docs/analysis/02-CODE-REFERENCE.md)** - Code Locations
- Key files & functions with line numbers
- Data flow summary
- Database schema reference
- Query patterns
- Important implementation notes

### 4. **[03-DATABASE-SCHEMA.md](./docs/analysis/03-DATABASE-SCHEMA.md)** - Visual Diagrams
- Entity Relationship Diagram (ERD)
- State transition diagrams
- Complete data flow journey (8 steps)
- File system organization
- Query access patterns

### 5. **[README.md](./docs/analysis/README.md)** - Documentation Index
- Overview of all documents
- Approval system status
- Architecture highlights
- Key constants & paths

---

## 🎯 Key Findings at a Glance

### ✅ What EXISTS (Review System)
- Binary review state: `pending` → `kept` | `trashed`
- User-driven actions: Keep/Trash buttons in gallery
- Soft delete with restoration capability
- Audit trail: TrashRecord tracks who deleted when
- Featured markers: Two independent flags (featured, featured2)
- Project cover: One image can be marked as cover

### ❌ What DOESN'T EXIST (Approval Workflow)
- Multi-stage approval (reviewer → approver → publisher)
- Role-based permissions (approver vs creator roles)
- Post-processing before approval (annotation, modification)
- Quality scoring or automated filtering
- Conditional publishing (e.g., "N% must be kept")
- Approval notifications or review queues

---

## 📦 Database Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **Run** | Generation request/result | status (queued/running/done/failed), comfyPromptId, outputDir |
| **ImageResult** | Individual image with review state | reviewStatus (pending/kept/trashed), filePath, thumbPath |
| **TrashRecord** | Audit trail for deleted images | originalPath, trashPath, deletedAt, restoredAt |
| **ProjectSection** | Generation configuration | aspectRatio, batchSize, ksampler params, loraConfig |

---

## 🔄 Image State Machine

```
GENERATION:  queued → running → done
                                  ↓
REVIEW:      pending → kept (✓ visible)
                    ↘ trashed (✗ hidden)
                         ↘ restore → pending
                                ↘ clearTrash() [deleted]
```

---

## 📂 File Organization

```
data/
├── images/
│   ├── {projectSlug}/
│   │   └── {sectionSlug}/
│   │       └── run-01-{runId}/
│   │           ├── raw/           (Full images, JPEG q=90)
│   │           ├── thumb/         (Thumbnails, 400x400, JPEG q=80)
│   │           └── workflow.json  (Saved ComfyUI workflow)
│   └── ...
└── trash/                         (Soft-deleted images)
    └── {imageId}/
```

---

## 🚀 Processing Pipeline

```
runSection()
  ↓
submitRunToComfyUI()  (Validate & submit)
  ↓
db.run.create()  (status: queued)
  ↓
pollRunCompletion()  [async background]  (Wait for execution)
  ↓
persistComfyOutputImages()  (Download, compress, store)
  ↓
db.imageResult.create()  (reviewStatus: pending)
  ↓
Gallery Display  (Show images)
  ↓
keepImages() or trashImages()  (User decision)
  ↓
OPTIONAL: restoreImage()  (From trash)
  ↓
OPTIONAL: clearTrash()  (Permanent delete)
```

---

## 💾 Key Code Locations

| Component | File | Function | Line |
|-----------|------|----------|------|
| Execution | run-executor.ts | submitRunToComfyUI | 147 |
| Execution | run-executor.ts | pollRunCompletion | 198 |
| Storage | image-result-service.ts | persistComfyOutputImages | 300 |
| Review | image-review.ts | keepImages | 29 |
| Review | image-review.ts | trashImages | 109 |
| Review | image-review.ts | restoreImage | 333 |
| Review | image-review.ts | clearTrash | 238 |
| Schema | prisma/schema.prisma | RunStatus enum | 19 |
| Schema | prisma/schema.prisma | ReviewStatus enum | 28 |

---

## ❓ FAQ

**Q: How are images generated?**  
A: ComfyUI generates them. The system submits a prompt, polls until completion, then downloads images.

**Q: Where are images stored?**  
A: `data/images/{project}/{section}/run-{id}/{raw|thumb}/` with backup copy in `data/trash/` if trashed.

**Q: What's the review system?**  
A: Images start as `pending`, user marks as `kept` (visible) or `trashed` (hidden).

**Q: Is there an approval workflow?**  
A: No. There's review (pending/kept/trashed) but no multi-stage approval or role-based permissions.

**Q: Can users restore trashed images?**  
A: Yes, until `clearTrash()` is called. After that, permanent deletion.

**Q: How are images served?**  
A: Through `/api/images/` routes. Atomic writes prevent partial reads during concurrent access.

**Q: How to query non-trashed images?**  
A: `WHERE reviewStatus != 'trashed' AND run.projectSectionId = ?`

**Q: What if I need approval workflow?**  
A: Extend ReviewStatus enum, add timestamps, implement auth checks, build UI. See recommendations in docs.

---

## 🛠️ For Implementation

### Adding Approval Workflow
1. Extend `ReviewStatus` enum: add `approved`, `published`
2. Add fields: `isPublished: Boolean`, `approvedAt: DateTime`  
3. Add auth: Check `approver` role before approve
4. Add UI: "Approve" button (for reviewers)
5. Add logging: Track approvals in AuditLog

### Making a Query
```typescript
// Get all non-trashed images in section
const images = await prisma.imageResult.findMany({
  where: {
    run: { projectSectionId },
    reviewStatus: { not: "trashed" }
  }
});
```

### Understanding a Run
```typescript
// Get run with all its images
const run = await prisma.run.findUnique({
  where: { id: runId },
  include: { images: true }
});
```

---

## 📊 System Capabilities

### ✓ Good For
- Individual users generating & reviewing images
- Exploring generation parameters
- Keeping/discarding based on visual inspection
- Organizing images by project/section
- Reproducible generation (workflows saved)
- Soft delete with restoration

### ✗ Not Good For
- Multi-person approval workflows
- Quality gates before publishing
- Role-based content moderation
- SLA/deadline enforcement
- Conditional publishing rules
- Image annotation/feedback during review

---

## 🎓 Understanding the Architecture

### Key Design Decisions
1. **Atomic Writes**: Temp file → rename prevents partial reads
2. **Fire-and-Forget**: Polling async, submission synchronous
3. **Soft Delete**: TrashRecord enables restoration before permanent deletion
4. **Reproducibility**: Full workflow JSON saved with images
5. **Compression**: All images converted to JPEG for consistency

### What Makes It Work
- **State Machine**: Clear states (queued/running/done/failed)
- **Relationships**: Project → Section → Run → Image → Trash
- **Audit Trail**: TrashRecord tracks all deletions
- **Recovery**: Stale runs re-polled after server restart

---

## 📖 Documentation Structure

```
IMAGE-LIFECYCLE.md (this file)
└── Executive summary & quick navigation

docs/analysis/
├── QUICK-REFERENCE.md         ← Start here for quick lookup
├── 01-IMAGE-LIFECYCLE.md      ← Complete lifecycle details
├── 02-CODE-REFERENCE.md       ← Code locations & patterns
├── 03-DATABASE-SCHEMA.md      ← Visual diagrams & flows
└── README.md                   ← Documentation index
```

---

## 🔗 Related Files in Codebase

**Core Services:**
- `src/server/services/run-executor.ts` - Execution & polling
- `src/server/services/image-result-service.ts` - Image storage
- `src/lib/actions/image-review.ts` - Review actions
- `src/lib/actions/section.ts` - Section management

**Database:**
- `prisma/schema.prisma` - Schema definitions

**UI Components:**
- `src/app/projects/[projectId]/sections/[sectionId]/results/` - Gallery display

---

## ✨ Summary

This is a **well-architected system** for **individual users** to generate and curate AI images. It has all the pieces of a review system but no formal approval workflow. The code is clean and would support adding approval workflows without major refactoring.

**Best use case:** Exploratory image generation and curation by individuals.  
**Not suitable for:** Complex approval pipelines requiring role-based permissions.

---

**For questions or updates:** See detailed documentation in `/docs/analysis/`

