# Image Lifecycle Documentation

This directory contains comprehensive documentation about the image lifecycle in the ComfyUI management system.

## Documents

### 1. [IMAGE LIFECYCLE](./01-IMAGE-LIFECYCLE.md)
Complete overview of how images flow through the system:
- Image generation flow (run execution)
- Image storage and database schema
- Image lifecycle states
- Review/approval system (or lack thereof)
- Image serving and display
- Key findings about approval concepts
- Complete lifecycle flow diagrams

**Key Insight**: There's a **review system** (pending → kept/trashed) but **NO approval workflow**. All users can review.

### 2. [CODE REFERENCE](./02-CODE-REFERENCE.md)
Practical guide to the codebase:
- Key files and functions with line numbers
- Data flow summary (submission, execution, review)
- Database schema reference
- Query patterns
- Important implementation notes

**Use this for**: Finding specific code, understanding data flow, implementing new features

### 3. [DATABASE SCHEMA](./03-DATABASE-SCHEMA.md)
Visual representation of the database:
- Entity Relationship Diagram (ERD)
- State transition diagrams
- Complete data flow journey (8 steps)
- File system organization
- Query access patterns

**Use this for**: Understanding relationships, visualizing data flow, query planning

## Quick Reference

### Image States
```
pending → kept (approved)
       ↘ trashed (rejected, moved to trash/)
            ↘ (permanent delete via clearTrash())
```

### Key Models
- **Run**: Generation request/result (queued → running → done/failed)
- **ImageResult**: Individual image with reviewStatus (pending/kept/trashed)
- **TrashRecord**: Audit trail for deleted images (soft delete)
- **ProjectSection**: Configuration for image generation

### Key Functions
- `submitRunToComfyUI()` - Submit to ComfyUI
- `pollRunCompletion()` - Poll until done
- `persistComfyOutputImages()` - Download & compress images
- `keepImages()` - Mark as approved
- `trashImages()` - Mark as rejected
- `clearTrash()` - Permanently delete

### File Storage
```
data/images/{projectSlug}/{sectionSlug}/run-{index}-{id}/
├── raw/        (full images, JPEG q=90)
├── thumb/      (400x400 thumbs, JPEG q=80)
└── workflow.json
```

## Approval System Status

### ✅ Exists
- Binary review: pending → kept/trashed
- User-driven actions (keep/trash buttons)
- Soft delete with restoration (TrashRecord)
- Audit trail (deletedAt, restoredAt, actorType)
- Featured markers (featured, featured2)
- Project cover image

### ❌ Missing
- Multi-stage approval workflow
- Role-based permissions (approver vs creator)
- Post-processing/annotation
- Automated quality scoring
- Conditional publishing rules
- Notifications

## Architecture Highlights

1. **Atomic Writes**: Images use temp file + rename to prevent partial reads
2. **Fire-and-Forget**: Polling happens async in background
3. **Soft Delete**: Trashed images can be restored before permanent deletion
4. **Reproducibility**: Full workflow JSON saved with images
5. **Compression**: All images converted to JPEG for consistency

---

*Last updated: 2026-05-27*
