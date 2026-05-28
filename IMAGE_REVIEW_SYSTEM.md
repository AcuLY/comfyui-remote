# Image Review System - Complete Model Definitions & Flow

## 1. PRISMA SCHEMA MODELS

### ReviewStatus Enum
```prisma
enum ReviewStatus {
  pending   # Default state for newly created images
  kept      # User marked image as kept (approved)
  trashed   # User marked image for deletion
}
```

### ImageResult Model
```prisma
model ImageResult {
  id                String          @id @default(cuid())
  runId             String
  filePath          String          @unique
  thumbPath         String?
  width             Int?
  height            Int?
  fileSize          BigInt?
  reviewStatus      ReviewStatus    @default(pending)    # ← Review status
  featured          Boolean         @default(false)
  featured2         Boolean         @default(false)
  reviewedAt        DateTime?                             # ← When reviewed
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  # Relations
  run               Run             @relation(fields: [runId], references: [id], onDelete: Cascade)
  trashRecord       TrashRecord?    # ← Links to trash data if trashed
  
  # Indices
  @@index([reviewStatus, createdAt])
  @@index([runId, createdAt])
}
```

### TrashRecord Model
```prisma
model TrashRecord {
  id                String       @id @default(cuid())
  imageResultId     String       @unique
  originalPath      String                             # ← Original file path before trash
  trashPath         String                             # ← Path in trash folder
  reason            String?                            # ← Optional reason for deletion
  deletedAt         DateTime     @default(now())
  restoredAt        DateTime?                          # ← Null while in trash, set on restore
  actorType         ActorType    @default(user)       # ← user, system, or agent
  
  # Relation
  imageResult       ImageResult  @relation(fields: [imageResultId], references: [id], onDelete: Cascade)
  
  # Indices
  @@index([deletedAt])
  @@index([restoredAt])
}
```

### Run Model
```prisma
model Run {
  id                    String                @id @default(cuid())
  projectId             String
  projectSectionId      String
  runIndex              Int                   @default(1)
  status                RunStatus             @default(queued)
  resolvedConfigSnapshot Json
  comfyPromptId         String?
  executionMeta         Json?
  submittedPrompt       Json?
  outputDir             String?
  comfyOutputSubfolder  String?
  errorMessage          String?               @db.Text
  startedAt             DateTime?
  finishedAt            DateTime?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  
  # Relations
  project               Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectSection        ProjectSection        @relation(fields: [projectSectionId], references: [id], onDelete: Cascade)
  images                ImageResult[]         # ← All images from this run
  
  # Indices
  @@index([status, createdAt])
  @@index([projectId, createdAt])
  @@index([projectSectionId, createdAt])
}
```

### ProjectSection Model
```prisma
model ProjectSection {
  id                    String                @id @default(cuid())
  projectId             String
  folderId              String?
  name                  String?
  sortOrder             Int                   @default(0)
  enabled               Boolean               @default(true)
  positivePrompt        String?               @db.Text
  negativePrompt        String?               @db.Text
  aspectRatio           String?
  shortSidePx           Int?
  batchSize             Int?
  seedPolicy1           String?
  seedPolicy2           String?
  ksampler1             Json?
  ksampler2             Json?
  upscaleFactor         Float?
  checkpointName        String?
  loraConfig            Json?
  extraParams           Json?
  latestRunId           String?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  
  # Relations
  project               Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  folder                ProjectSectionFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)
  runs                  Run[]                 # ← All runs in this section
  promptBlocks          PromptBlock[]
  changeLogs            SectionChangeLog[]
  
  # Indices
  @@index([projectId, sortOrder])
  @@index([folderId])
}
```

---

## 2. DATABASE ENUMS

```typescript
// src/lib/db-enums.ts

export const ReviewStatus = {
  pending: "pending",
  kept: "kept",
  trashed: "trashed",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const ActorType = {
  user: "user",
  system: "system",
  agent: "agent",
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];
```

---

## 3. IMAGE REVIEW FLOW

### Flow Overview

```
┌─────────────────────┐
│  ImageResult        │
│  reviewStatus:      │
│  - pending (new)    │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 KEPT         TRASH
 │            │
 │            ├─► TrashRecord created
 │            │   (originalPath, trashPath)
 │            │
 │            ├─► File moved from:
 │            │   data/images/xxx.png
 │            │   to:
 │            │   data/images/.trash/xxx-{id}.png
 │            │
 │            └─► reviewStatus = "trashed"
 │
 └─► reviewStatus = "kept"
 
RESTORE (from trash):
┌─────────────────────┐
│  ImageResult        │
│  reviewStatus:      │
│  trashed            │
│  + TrashRecord      │
└──────────┬──────────┘
           │
           ├─► File moved back to originalPath
           │
           ├─► TrashRecord.restoredAt = now
           │
           └─► reviewStatus = "pending"
```

### Key Operations

#### 1. **Keep Image(s)**
- **Action**: Mark image as approved/kept
- **Server Action**: `keepRunImages(runId, imageIds)`
- **Changes**:
  - `ImageResult.reviewStatus` → "kept"
  - `ImageResult.reviewedAt` → current timestamp
  - If image was in trash: `TrashRecord.restoredAt` → current timestamp
  - If image was in trash: File moved from trash path to original path

#### 2. **Trash Image(s)**
- **Action**: Mark image for deletion
- **Server Action**: `trashRunImages(runId, imageIds, reason?)`
- **Changes**:
  - `ImageResult.reviewStatus` → "trashed"
  - `ImageResult.reviewedAt` → current timestamp
  - `ImageResult.filePath` → trash path (e.g., `.trash/xxx-{id}.png`)
  - File physically moved from `data/images/xxx.png` → trash folder
  - `TrashRecord` created or updated with:
    - `originalPath` ← before trash path
    - `trashPath` ← new trash path
    - `reason` ← optional user-provided reason
    - `deletedAt` ← current timestamp
    - `restoredAt` ← null (still in trash)
    - `actorType` ← "user" (or "system"/"agent")

#### 3. **Restore Image**
- **Action**: Recover image from trash
- **Endpoint**: `POST /api/images/[imageId]/restore`
- **Service**: `restoreImage(imageId)`
- **Changes**:
  - `ImageResult.reviewStatus` → "pending"
  - `ImageResult.filePath` → original path (from `TrashRecord.originalPath`)
  - `ImageResult.reviewedAt` → current timestamp
  - File moved from trash path back to original path
  - `TrashRecord.restoredAt` → current timestamp (marks restoration)

#### 4. **Clear Trash (Permanent Delete)**
- **Action**: Permanently delete all trashed images
- **Server Action**: `clearTrash()`
- **Changes**:
  - Delete all `TrashRecord` rows with `restoredAt = null`
  - Delete corresponding `ImageResult` rows
  - Physically delete files from disk (best-effort)
  - Clear project cover image if pointing to deleted image
  - Revalidate cache for related pages

---

## 4. SERVER ACTIONS & SERVICES

### Server Actions (`src/lib/actions/image-review.ts`)
```typescript
export async function keepImages(imageIds: string[])
export async function trashImages(imageIds: string[])
export async function trashProjectImages(projectId: string)
export async function clearTrash()
export async function restoreImage(trashRecordId: string)
export async function getSectionTrashItems(sectionId: string)
```

### Review Service (`src/server/services/review-service.ts`)
```typescript
export async function keepRunImages(
  runId: string, 
  body: unknown, 
  actorType: ActorType = ActorType.user
)

export async function trashRunImages(
  runId: string, 
  body: unknown, 
  actorType: ActorType = ActorType.user
)

export async function restoreImage(
  imageId: string, 
  actorType: ActorType = ActorType.user
)

export async function getRunReviewGroup(runId: string)
export async function getRunAgentContext(runId: string)
```

### Review Repository (`src/server/repositories/review-repository.ts`)
```typescript
export async function keepRunImages(runId: string, imageIds: string[])
export async function trashRunImages(runId: string, imageIds: string[], reason?: string)
export async function restoreImage(imageId: string)
export async function getRunReviewGroup(runId: string)
export async function getRunAgentContext(runId: string)
```

---

## 5. API ENDPOINTS

### Restore Image
- **Route**: `POST /api/images/[imageId]/restore`
- **Params**: `imageId` (from URL)
- **Body**: None
- **Response**: `{ imageId, reviewStatus: "pending", reviewedAt, restoredAt }`

### Keep Images (if exists)
- **Route**: `POST /api/runs/[runId]/images/keep` (or similar)
- **Body**: `{ imageIds: string[] }`
- **Response**: `{ runId, updatedCount, imageIds, reviewStatus: "kept", reviewedAt }`

### Trash Images (if exists)
- **Route**: `POST /api/runs/[runId]/images/trash` (or similar)
- **Body**: `{ imageIds: string[], reason?: string }`
- **Response**: `{ runId, updatedCount, imageIds, reviewStatus: "trashed", reviewedAt }`

---

## 6. RELATIONSHIPS & CASCADING

```
Project
  └─ ProjectSection
      └─ Run
          └─ ImageResult
              └─ TrashRecord (1:1, optional)
```

### Delete Cascading
- Delete `Project` → Cascade deletes `ProjectSection`, `Run`, `ImageResult`, `TrashRecord`
- Delete `ProjectSection` → Cascade deletes `Run`, `ImageResult`, `TrashRecord`
- Delete `Run` → Cascade deletes `ImageResult`, `TrashRecord`
- Delete `ImageResult` → Cascade deletes `TrashRecord`

### Foreign Key Constraints
- `ImageResult.runId` → `Run.id` (Cascade)
- `TrashRecord.imageResultId` → `ImageResult.id` (Cascade, unique)

---

## 7. INDEXING STRATEGY

```
ImageResult:
  - (@index) [reviewStatus, createdAt]  ← Efficient review status queries
  - (@index) [runId, createdAt]          ← Efficient run image queries

TrashRecord:
  - (@index) [deletedAt]                 ← Efficient trash listing
  - (@index) [restoredAt]                ← Efficient trash/restored filtering

Run:
  - (@index) [status, createdAt]
  - (@index) [projectId, createdAt]
  - (@index) [projectSectionId, createdAt]

ProjectSection:
  - (@index) [projectId, sortOrder]
```

---

## 8. KEY FIELD DEFINITIONS

| Model | Field | Type | Purpose |
|-------|-------|------|---------|
| ImageResult | `id` | String (CUID) | Unique identifier |
| ImageResult | `runId` | String | Foreign key to Run |
| ImageResult | `filePath` | String (@unique) | Current file path (original or trash) |
| ImageResult | `thumbPath` | String? | Thumbnail path |
| ImageResult | `reviewStatus` | ReviewStatus enum | pending \| kept \| trashed |
| ImageResult | `reviewedAt` | DateTime? | When status was set |
| ImageResult | `featured` | Boolean | UI featured flag |
| TrashRecord | `imageResultId` | String (@unique) | FK to ImageResult |
| TrashRecord | `originalPath` | String | Path before trashing |
| TrashRecord | `trashPath` | String | Path in trash folder |
| TrashRecord | `reason` | String? | Optional deletion reason |
| TrashRecord | `deletedAt` | DateTime | When moved to trash |
| TrashRecord | `restoredAt` | DateTime? | When restored (null = still trashed) |
| TrashRecord | `actorType` | ActorType enum | user \| system \| agent |

