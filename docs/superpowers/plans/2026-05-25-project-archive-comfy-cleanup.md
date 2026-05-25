# Project Archive & ComfyUI Output Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicate image storage by tracking ComfyUI output paths, adding project lifecycle states (published/archived), and enabling bulk cleanup of completed projects' image files.

**Architecture:** Add a `comfyOutputSubfolder` field to the existing `Run` model (no new table needed — it's 1:1 with run). Add `publishedAt`/`archivedAt` DateTime fields to `Project`. Create a new `project-archive-service.ts` that handles the archive operation (verify export exists, delete managed images, delete ComfyUI output, set timestamps). Expose via a new API route.

**Tech Stack:** Next.js App Router, Prisma (SQLite + PostgreSQL dual-schema), TypeScript, sharp (images), node:fs/promises

---

## Design Decisions

### Q1: Separate table vs. field on Run?

**Decision: Field on Run.** The ComfyUI output subfolder is 1:1 with a Run. The Run model already stores `outputDir` (the managed output directory). Adding `comfyOutputSubfolder` as a nullable String field keeps things simple. No join needed, no orphan records to worry about.

### Q2: Cleanup API — batch or per-project?

**Decision: Per-project via the archive endpoint.** The archive endpoint for a project handles all its runs' ComfyUI output cleanup in one atomic operation. A separate "admin" endpoint can list all un-archived done projects for bulk archive. This keeps the mental model simple: "archive a project" = one button.

### Q3: What happens to ImageResult records after archive?

**Decision: Keep them.** ImageResult records store metadata (dimensions, review status, featured flags) that's valuable for reference. The `filePath` will point to deleted files, but the UI will detect archived state and show a placeholder. No data loss.

### Q4: Export + Archive in one step?

**Decision: Archive requires prior export (separate steps).** The export is a creative decision (choosing which images to feature). Archive is a cleanup operation. Keeping them separate avoids accidental data loss. The UI will enforce: archive button only enabled when `publishedAt` is set.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` | Add `comfyOutputSubfolder` to Run, `publishedAt`/`archivedAt` to Project |
| Modify | `prisma/schema.sqlite.prisma` | Same changes for SQLite schema |
| Create | `prisma/migrations-sqlite/YYYYMMDD_add_archive_fields/migration.sql` | Via `prisma migrate dev` |
| Modify | `src/server/services/run-executor.ts` | Record `comfyOutputSubfolder` after image persistence |
| Modify | `src/server/services/comfyui-service.ts` | (no changes needed — `extractOutputDir` already exists) |
| Modify | `src/server/services/project-export-service.ts` | Set `publishedAt` on successful export |
| Modify | `src/app/api/projects/[projectId]/export/route.ts` | (no changes needed — service handles it) |
| Create | `src/server/services/project-archive-service.ts` | Archive logic: verify export, delete files, set timestamp |
| Create | `src/app/api/projects/[projectId]/archive/route.ts` | POST endpoint for archive |
| Modify | `src/server/worker/repository.ts` | Pass `comfyOutputSubfolder` in `completeWorkerRun` |

---

## Task 1: Add Schema Fields

**Files:**
- Modify: `prisma/schema.prisma` (lines 310–329 — Project model, lines 428–451 — Run model)
- Modify: `prisma/schema.sqlite.prisma` (lines 208–228 — Project model, lines 324–347 — Run model)

- [ ] **Step 1: Add fields to PostgreSQL schema**

In `prisma/schema.prisma`, add to the `Project` model (after `notes` field, before `createdAt`):

```prisma
  publishedAt           DateTime?
  archivedAt            DateTime?
```

In `prisma/schema.prisma`, add to the `Run` model (after `outputDir` field):

```prisma
  comfyOutputSubfolder  String?
```

The full `Project` model block should look like:
```prisma
model Project {
  id                    String                @id @default(cuid())
  title                 String
  slug                  String                @unique
  status                JobStatus             @default(draft)
  coverImageId          String?
  folderId              String?
  presetBindings        Json?                 // [{ categoryId, presetId, variantId? }]
  checkpointName        String?
  projectLevelOverrides Json?
  notes                 String?               @db.Text
  publishedAt           DateTime?
  archivedAt            DateTime?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  folder                ProjectFolder?        @relation(fields: [folderId], references: [id], onDelete: SetNull)
  sections              ProjectSection[]
  sectionFolders        ProjectSectionFolder[]
  runs                  Run[]
  @@index([status, updatedAt])
  @@index([coverImageId])
  @@index([folderId])
}
```

The `Run` model `outputDir` + new field area:
```prisma
  outputDir             String?
  comfyOutputSubfolder  String?
  errorMessage          String?               @db.Text
```

- [ ] **Step 2: Add same fields to SQLite schema**

In `prisma/schema.sqlite.prisma`, add to `Project` model (after `notes`, before `createdAt`):

```prisma
  publishedAt           DateTime?
  archivedAt            DateTime?
```

In `prisma/schema.sqlite.prisma`, add to `Run` model (after `outputDir`, before `errorMessage`):

```prisma
  comfyOutputSubfolder  String?
```

- [ ] **Step 3: Generate migration for SQLite**

```bash
cd /Users/luca/dev/comfyui-remote
DB_PROVIDER=sqlite DATABASE_URL=file:./prisma/data/comfyui.db pnpm prisma migrate dev --name add_archive_and_comfy_output_fields
```

Expected: Creates `prisma/migrations-sqlite/YYYYMMDDHHMMSS_add_archive_and_comfy_output_fields/migration.sql` with:
```sql
ALTER TABLE "Project" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Run" ADD COLUMN "comfyOutputSubfolder" TEXT;
```

- [ ] **Step 4: Generate Prisma client for both providers**

```bash
pnpm prisma:generate:all
```

Expected: Both `src/generated/prisma/` and `src/generated/prisma-sqlite/` are regenerated with new fields.

- [ ] **Step 5: Verify build compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No new type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/schema.sqlite.prisma prisma/migrations-sqlite/
git commit -m "schema: add publishedAt/archivedAt to Project, comfyOutputSubfolder to Run"
```

---

## Task 2: Record ComfyUI Output Subfolder on Run Completion

**Files:**
- Modify: `src/server/services/run-executor.ts` (around line 370)
- Modify: `src/server/worker/repository.ts` (lines 27–41 — CompleteWorkerRunInput type, lines 167–246 — completeWorkerRun function)

- [ ] **Step 1: Add `comfyOutputSubfolder` to CompleteWorkerRunInput**

In `src/server/worker/repository.ts`, update the `CompleteWorkerRunInput` type:

```typescript
type CompleteWorkerRunInput = {
  status: "done" | "failed";
  errorMessage?: string | null;
  comfyPromptId?: string | null;
  executionMeta?: Record<string, unknown> | null;
  submittedPrompt?: Record<string, unknown> | null;
  outputDir?: string | null;
  comfyOutputSubfolder?: string | null;
  images?: Array<{
    filePath: string;
    thumbPath: string | null;
    width: number | null;
    height: number | null;
    fileSize: bigint | null;
  }>;
};
```

- [ ] **Step 2: Persist `comfyOutputSubfolder` in the transaction**

In `src/server/worker/repository.ts`, inside `completeWorkerRun`, after the `if (input.outputDir !== undefined)` block (around line 194–196), add:

```typescript
    if (input.comfyOutputSubfolder !== undefined) {
      data.comfyOutputSubfolder = input.comfyOutputSubfolder;
    }
```

- [ ] **Step 3: Pass `comfyOutputSubfolder` from run-executor**

In `src/server/services/run-executor.ts`, the `completeWorkerRun` call (around line 370) currently looks like:

```typescript
      await completeWorkerRun(runId, {
        status: RunStatus.done,
        comfyPromptId,
        executionMeta,
        submittedPrompt: apiPrompt,
        outputDir: persistedOutput.outputDir,
        images: persistedOutput.images,
      });
```

Update it to also import `extractOutputDir` and pass the subfolder:

First, add `extractOutputDir` to the existing import from `comfyui-service` (line 22):
```typescript
import {
  validateComfyPromptDraft,
  submitComfyPrompt,
  pollComfyPromptHistory,
  extractOutputImages,
  extractOutputDir,
  extractExecutionMeta,
  getComfyQueuePosition,
  ComfyPromptPollAbortedError,
  type SubmitComfyPromptOptions,
  type ValidatedComfyPromptDraft,
} from "@/server/services/comfyui-service";
```

Then update the `completeWorkerRun` call:
```typescript
      await completeWorkerRun(runId, {
        status: RunStatus.done,
        comfyPromptId,
        executionMeta,
        submittedPrompt: apiPrompt,
        outputDir: persistedOutput.outputDir,
        comfyOutputSubfolder: extractOutputDir(outputImages),
        images: persistedOutput.images,
      });
```

Note: `outputImages` is already in scope from line 344: `const outputImages = extractOutputImages(historyEntry);`

- [ ] **Step 4: Verify build compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/run-executor.ts src/server/worker/repository.ts
git commit -m "feat: record ComfyUI output subfolder on run completion"
```

---

## Task 3: Set `publishedAt` on Successful Export

**Files:**
- Modify: `src/server/services/project-export-service.ts` (around line 168, before the return)

- [ ] **Step 1: Add prisma import if needed and set publishedAt**

The file already imports `prisma` on line 6: `import { prisma } from "@/lib/prisma";`

Before the final `return` statement (line 168), add a `prisma.project.update` call to set `publishedAt`:

```typescript
  // Mark project as published
  await prisma.project.update({
    where: { id: projectId },
    data: { publishedAt: new Date() },
  });

  return {
    success: true,
    message: `图片整合完成：${allKept.length} 张保留图打包为 ${exportName}.zip，封面已输出 cover.jpg${pixivIndex > 1 ? `，${pixivIndex - 1} 张 p站图输出到 pixiv/` : ""}${previewIndex > 1 ? `，${previewIndex - 1} 张预览图输出到 preview/` : ""}`,
    path: exportDir,
  };
```

This means every time export succeeds, `publishedAt` is refreshed. This is intentional — the user may re-export after making changes.

- [ ] **Step 2: Verify build compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/project-export-service.ts
git commit -m "feat: set publishedAt timestamp on successful project export"
```

---

## Task 4: Create Project Archive Service

**Files:**
- Create: `src/server/services/project-archive-service.ts`

- [ ] **Step 1: Write the archive service**

Create `src/server/services/project-archive-service.ts`:

```typescript
import { access, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "project-archive" });

const EXPORT_ROOT = resolve(process.cwd(), "data", "export");
const IMAGES_ROOT = resolve(process.cwd(), "data", "images");

export type ArchiveProjectResult = {
  success: boolean;
  message: string;
  deletedManagedFiles: number;
  deletedComfyDirs: number;
};

/**
 * Archive a completed, published project:
 * 1. Verify export zip exists
 * 2. Delete managed image files (data/images/{project-slug}/)
 * 3. Delete ComfyUI output files for this project's runs
 * 4. Set archivedAt timestamp
 */
export async function archiveProject(projectId: string): Promise<ArchiveProjectResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      archivedAt: true,
    },
  });

  if (!project) {
    return { success: false, message: "Project not found", deletedManagedFiles: 0, deletedComfyDirs: 0 };
  }

  if (project.archivedAt) {
    return { success: false, message: "Project is already archived", deletedManagedFiles: 0, deletedComfyDirs: 0 };
  }

  if (!project.publishedAt) {
    return { success: false, message: "Project must be exported (published) before archiving", deletedManagedFiles: 0, deletedComfyDirs: 0 };
  }

  if (project.status !== "done" && project.status !== "partial_done") {
    return { success: false, message: `Project status is "${project.status}" — must be done or partial_done to archive`, deletedManagedFiles: 0, deletedComfyDirs: 0 };
  }

  // Verify export directory exists
  const exportDir = join(EXPORT_ROOT, project.title);
  try {
    await access(exportDir);
  } catch {
    return { success: false, message: `Export directory not found: ${project.title}/ — please re-export first`, deletedManagedFiles: 0, deletedComfyDirs: 0 };
  }

  let deletedManagedFiles = 0;
  let deletedComfyDirs = 0;

  // 1. Delete managed image directory (data/images/{slug}/)
  const managedImageDir = join(IMAGES_ROOT, project.slug);
  try {
    await access(managedImageDir);
    await rm(managedImageDir, { recursive: true, force: true });
    deletedManagedFiles = 1; // directory count
    log.info("Deleted managed image directory", { projectId, path: managedImageDir });
  } catch {
    log.debug("Managed image directory not found, skipping", { projectId, path: managedImageDir });
  }

  // 2. Delete ComfyUI output files for this project's runs
  const comfyLaunchCwd = env.comfyLaunchCwd;
  if (comfyLaunchCwd) {
    const runs = await prisma.run.findMany({
      where: {
        projectId: project.id,
        comfyOutputSubfolder: { not: null },
      },
      select: {
        id: true,
        comfyOutputSubfolder: true,
      },
    });

    // Collect unique subfolder paths
    const uniqueSubfolders = new Set<string>();
    for (const run of runs) {
      if (run.comfyOutputSubfolder) {
        uniqueSubfolders.add(run.comfyOutputSubfolder);
      }
    }

    const comfyOutputBase = join(comfyLaunchCwd, "output");

    for (const subfolder of uniqueSubfolders) {
      const comfyDir = join(comfyOutputBase, subfolder);

      // Safety: ensure the resolved path is still under the output base
      const resolved = resolve(comfyDir);
      if (!resolved.startsWith(resolve(comfyOutputBase))) {
        log.warn("Skipping suspicious ComfyUI output path", { subfolder, resolved });
        continue;
      }

      try {
        await access(comfyDir);
        await rm(comfyDir, { recursive: true, force: true });
        deletedComfyDirs++;
        log.info("Deleted ComfyUI output directory", { projectId, path: comfyDir });
      } catch {
        log.debug("ComfyUI output directory not found, skipping", { projectId, path: comfyDir });
      }
    }
  }

  // 3. Set archivedAt timestamp
  await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
  });

  const message = `Project "${project.title}" archived. Deleted managed images dir${comfyLaunchCwd ? ` and ${deletedComfyDirs} ComfyUI output dir(s)` : ""}.`;
  log.info("Project archived", { projectId, deletedManagedFiles, deletedComfyDirs });

  return { success: true, message, deletedManagedFiles, deletedComfyDirs };
}
```

- [ ] **Step 2: Verify build compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/project-archive-service.ts
git commit -m "feat: add project archive service for cleanup of completed projects"
```

---

## Task 5: Create Archive API Route

**Files:**
- Create: `src/app/api/projects/[projectId]/archive/route.ts`

- [ ] **Step 1: Create the archive API endpoint**

Create directory and file at `src/app/api/projects/[projectId]/archive/route.ts`:

```typescript
import { fail, ok } from "@/lib/api-response";
import { archiveProject } from "@/server/services/project-archive-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const result = await archiveProject(projectId);

    if (!result.success) {
      const status = result.message.includes("not found") ? 404 : 409;
      return fail(result.message, status);
    }

    return ok(result);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to archive project",
      500,
    );
  }
}
```

- [ ] **Step 2: Verify build compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[projectId]/archive/route.ts
git commit -m "feat: add POST /api/projects/[projectId]/archive endpoint"
```

---

## Task 6: Include `publishedAt`/`archivedAt` in Project API Responses

**Files:**
- Modify: `src/server/services/project-service.ts` (the `listProjects` and related queries)
- Modify: `src/app/api/projects/[projectId]/route.ts` (the GET handler)

- [ ] **Step 1: Identify where project data is selected and add new fields**

Check how projects are queried. The `listProjects` function in `src/server/services/project-service.ts` likely has a `select` clause. Add `publishedAt` and `archivedAt` to any project select/include that returns to the API.

In `src/server/services/project-service.ts`, find the `listProjects` function (line 352) and update its select to include the new fields. The exact change depends on whether it uses `select` or returns all fields. If it uses `findMany` without explicit `select`, the new fields are automatically included.

Search for explicit `select` patterns on Project queries:

```bash
grep -n "publishedAt\|archivedAt" src/server/services/project-service.ts
```

If no results, the fields are already returned by default (Prisma returns all scalar fields unless `select` is used).

For the single-project GET endpoint in `src/app/api/projects/[projectId]/route.ts`, check if it uses a `select` clause. If so, add:

```typescript
publishedAt: true,
archivedAt: true,
```

- [ ] **Step 2: Verify the API returns the new fields**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Then manually verify by checking the route handler code. If the project is fetched with `prisma.project.findUnique({ where: ... })` without a `select`, both new fields will be included automatically.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add src/server/services/project-service.ts src/app/api/projects/[projectId]/route.ts
git commit -m "feat: include publishedAt/archivedAt in project API responses"
```

---

## Task 7: Integration Test — Full Archive Flow

**Files:**
- Create: `test-project-archive.test.ts` (root-level, following existing test convention)

- [ ] **Step 1: Write an integration test for the archive service**

Create `test-project-archive.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { archiveProject } from "@/server/services/project-archive-service";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const EXPORT_ROOT = resolve(process.cwd(), "data", "export");
const IMAGES_ROOT = resolve(process.cwd(), "data", "images");

describe("archiveProject", () => {
  let testProjectId: string;
  const testTitle = "test-archive-project";
  const testSlug = "test-archive-project";

  beforeAll(async () => {
    // Create a test project directly in DB
    const project = await prisma.project.create({
      data: {
        title: testTitle,
        slug: testSlug,
        status: "done",
        publishedAt: new Date(),
      },
    });
    testProjectId = project.id;

    // Create fake export directory
    const exportDir = join(EXPORT_ROOT, testTitle);
    await mkdir(exportDir, { recursive: true });
    await writeFile(join(exportDir, `${testTitle}.zip`), "fake-zip");

    // Create fake managed images directory
    const imagesDir = join(IMAGES_ROOT, testSlug);
    await mkdir(join(imagesDir, "section-1", "run-01-abc", "raw"), { recursive: true });
    await writeFile(join(imagesDir, "section-1", "run-01-abc", "raw", "01.png"), "fake-image");
  });

  afterAll(async () => {
    // Cleanup
    await prisma.project.deleteMany({ where: { slug: testSlug } });
    const { rm } = await import("node:fs/promises");
    await rm(join(EXPORT_ROOT, testTitle), { recursive: true, force: true });
    await rm(join(IMAGES_ROOT, testSlug), { recursive: true, force: true });
  });

  it("should reject archive if not published", async () => {
    // Create unpublished project
    const proj = await prisma.project.create({
      data: { title: "unpub", slug: "unpub-test", status: "done" },
    });
    const result = await archiveProject(proj.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain("exported");
    await prisma.project.delete({ where: { id: proj.id } });
  });

  it("should reject archive if project is not done", async () => {
    const proj = await prisma.project.create({
      data: { title: "draft-proj", slug: "draft-test", status: "draft", publishedAt: new Date() },
    });
    const result = await archiveProject(proj.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain("status");
    await prisma.project.delete({ where: { id: proj.id } });
  });

  it("should archive a published done project", async () => {
    const result = await archiveProject(testProjectId);
    expect(result.success).toBe(true);
    expect(result.deletedManagedFiles).toBe(1);

    // Verify managed images dir is gone
    await expect(access(join(IMAGES_ROOT, testSlug))).rejects.toThrow();

    // Verify archivedAt is set
    const project = await prisma.project.findUnique({
      where: { id: testProjectId },
      select: { archivedAt: true },
    });
    expect(project?.archivedAt).not.toBeNull();
  });

  it("should reject double archive", async () => {
    const result = await archiveProject(testProjectId);
    expect(result.success).toBe(false);
    expect(result.message).toContain("already archived");
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm vitest run test-project-archive.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test-project-archive.test.ts
git commit -m "test: add integration tests for project archive flow"
```

---

## Task 8: Backfill `comfyOutputSubfolder` for Existing Runs (Optional Script)

**Files:**
- Create: `src/scripts/backfill-comfy-output-subfolder.ts`

This is optional — only needed if you want to archive projects that were completed before this feature was deployed. The backfill logic is: for each Run with `status=done` and `comfyOutputSubfolder=null`, compute the subfolder from the project title and section sort order (matching the `outputPath` logic in `comfyui-service.ts` line 471).

- [ ] **Step 1: Write the backfill script**

Create `src/scripts/backfill-comfy-output-subfolder.ts`:

```typescript
/**
 * Backfill comfyOutputSubfolder for existing completed runs.
 *
 * The ComfyUI output path pattern is: {projectTitle}/{sortOrder}.{sectionSlug}
 * This matches the logic in comfyui-service.ts buildComfyPromptFromDraft().
 *
 * Usage: npx tsx src/scripts/backfill-comfy-output-subfolder.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const runs = await prisma.run.findMany({
    where: {
      status: "done",
      comfyOutputSubfolder: null,
    },
    select: {
      id: true,
      project: { select: { title: true } },
      projectSection: { select: { sortOrder: true, name: true } },
    },
  });

  console.log(`Found ${runs.length} runs to backfill`);

  let updated = 0;
  for (const run of runs) {
    const sortOrder = run.projectSection.sortOrder + 1;
    const sectionSlug = `section_${sortOrder}`;
    const subfolder = `${run.project.title}/${sortOrder}.${sectionSlug}`;

    await prisma.run.update({
      where: { id: run.id },
      data: { comfyOutputSubfolder: subfolder },
    });
    updated++;
  }

  console.log(`Backfilled ${updated} runs`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the backfill**

```bash
npx tsx src/scripts/backfill-comfy-output-subfolder.ts
```

Expected: Outputs count of backfilled runs.

- [ ] **Step 3: Commit**

```bash
git add src/scripts/backfill-comfy-output-subfolder.ts
git commit -m "feat: add backfill script for comfyOutputSubfolder on existing runs"
```

---

## Summary of Changes

After all tasks are complete:

1. **Schema**: `Project` has `publishedAt`/`archivedAt` fields. `Run` has `comfyOutputSubfolder` field.
2. **Run executor**: Automatically records the ComfyUI output subfolder when a run completes.
3. **Export service**: Automatically sets `publishedAt` on successful export.
4. **Archive service**: New `archiveProject()` function that validates preconditions, deletes files, and sets `archivedAt`.
5. **API**: New `POST /api/projects/[projectId]/archive` endpoint.
6. **Backfill**: Optional script for existing data.

The UI work (showing archive button, published/archived badges, "archived" placeholder for missing images) is out of scope for this plan and can be done as a follow-up.
