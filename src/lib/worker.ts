/**
 * Worker — consumes queued PositionRun records and executes them via ComfyUI.
 *
 * Flow per run:
 *   1. Pick a queued PositionRun from DB
 *   2. Resolve its full config (job + position template + overrides)
 *   3. Build ComfyUI prompt payload
 *   4. Submit to ComfyUI /prompt
 *   5. Poll /history until complete
 *   6. Download output images + generate thumbnails
 *   7. Write ImageResult records to DB
 *   8. Update PositionRun status → done
 *   9. Update CompleteJob status if all positions are done
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getComfyUIClient } from "@/lib/comfyui-client";
import { buildPromptPayload, type ResolvedRunConfig } from "@/lib/prompt-builder";
import { generateThumbnail } from "@/lib/thumbnail";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OUTPUT_BASE =
  process.env.OUTPUT_BASE_PATH ??
  path.join(/* turbopackIgnore: true */ process.cwd(), "data/images");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerResult = {
  runId: string;
  status: "done" | "failed";
  imagesCreated: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Core: process a single PositionRun
// ---------------------------------------------------------------------------

export async function processRun(runId: string): Promise<WorkerResult> {
  const client = getComfyUIClient();

  try {
    // 1. Mark as running
    await prisma.positionRun.update({
      where: { id: runId },
      data: { status: "running", startedAt: new Date() },
    });

    // 2. Load full context from DB
    const run = await prisma.positionRun.findUnique({
      where: { id: runId },
      include: {
        completeJob: true,
        completeJobPosition: {
          include: { positionTemplate: true },
        },
      },
    });

    if (!run) {
      throw new Error(`PositionRun ${runId} not found`);
    }

    const pos = run.completeJobPosition;
    const tmpl = pos.positionTemplate;
    const job = run.completeJob;

    // 3. Resolve config
    const config: ResolvedRunConfig = {
      characterPrompt: job.characterPrompt,
      scenePrompt: job.scenePrompt,
      stylePrompt: job.stylePrompt,
      positionPrompt: tmpl.prompt,
      positivePromptOverride: pos.positivePrompt,
      negativePrompt: pos.negativePrompt ?? tmpl.negativePrompt,
      characterLoraPath: job.characterLoraPath,
      aspectRatio: pos.aspectRatio ?? tmpl.defaultAspectRatio ?? "3:4",
      batchSize: pos.batchSize ?? tmpl.defaultBatchSize ?? 1,
      seedPolicy: pos.seedPolicy ?? tmpl.defaultSeedPolicy ?? "random",
    };

    // 4. Build & submit prompt
    const payload = buildPromptPayload(config);
    console.log(`[worker] Submitting prompt for run ${runId}...`);
    const { prompt_id } = await client.submitPrompt(payload);

    // 5. Update comfyPromptId
    await prisma.positionRun.update({
      where: { id: runId },
      data: { comfyPromptId: prompt_id },
    });

    // 6. Wait for completion
    console.log(`[worker] Waiting for ComfyUI prompt ${prompt_id}...`);
    const result = await client.waitForCompletion(prompt_id);

    if (result.status.status_str !== "success") {
      throw new Error(`ComfyUI prompt ${prompt_id} ended with status: ${result.status.status_str}`);
    }

    // 7. Collect all output images from all output nodes
    const outputImages: Array<{ filename: string; subfolder: string; type: string }> = [];
    for (const nodeOutput of Object.values(result.outputs)) {
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          if (img.type === "output") {
            outputImages.push(img);
          }
        }
      }
    }

    console.log(`[worker] Got ${outputImages.length} output images for run ${runId}`);

    // 8. Prepare output directory
    const jobSlug = job.slug;
    const runDir = path.join(OUTPUT_BASE, jobSlug, runId);
    const rawDir = path.join(runDir, "raw");
    const thumbDir = path.join(runDir, "thumb");
    await mkdir(rawDir, { recursive: true });
    await mkdir(thumbDir, { recursive: true });

    // 9. Download images, generate thumbnails, write DB records
    // Store paths relative to OUTPUT_BASE so frontend uses /api/images/<relative>
    const relativeRunDir = `${jobSlug}/${runId}`;
    let imagesCreated = 0;
    for (const img of outputImages) {
      try {
        const imageData = await client.downloadImage(img.filename, img.subfolder, img.type);
        const buffer = Buffer.from(imageData);

        const ext = path.extname(img.filename) || ".png";
        const baseName = `${String(imagesCreated + 1).padStart(3, "0")}${ext}`;
        const rawAbsolute = path.join(rawDir, baseName);
        const thumbAbsolute = path.join(thumbDir, baseName);

        // Write raw image to disk
        await writeFile(rawAbsolute, buffer);

        // Generate thumbnail (max 400px wide)
        await generateThumbnail(buffer, thumbAbsolute, 400);

        const fileSize = buffer.length;

        // Store as /api/images/<relative> paths for frontend consumption
        const filePathForDb = `/api/images/${relativeRunDir}/raw/${baseName}`;
        const thumbPathForDb = `/api/images/${relativeRunDir}/thumb/${baseName}`;

        // Write DB record
        await prisma.imageResult.create({
          data: {
            positionRunId: runId,
            filePath: filePathForDb,
            thumbPath: thumbPathForDb,
            fileSize: BigInt(fileSize),
            reviewStatus: "pending",
          },
        });

        imagesCreated++;
      } catch (imgErr) {
        console.error(`[worker] Failed to process image ${img.filename}:`, imgErr);
      }
    }

    // 10. Mark run as done
    await prisma.positionRun.update({
      where: { id: runId },
      data: {
        status: "done",
        finishedAt: new Date(),
        outputDir: runDir,
      },
    });

    // 11. Check if all runs for the parent job are done
    await updateJobStatus(job.id);

    console.log(`[worker] Run ${runId} complete — ${imagesCreated} images saved`);
    return { runId, status: "done", imagesCreated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Run ${runId} failed:`, message);

    await prisma.positionRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });

    // Also update parent job status
    const run = await prisma.positionRun.findUnique({
      where: { id: runId },
      select: { completeJobId: true },
    });
    if (run) {
      await updateJobStatus(run.completeJobId);
    }

    return { runId, status: "failed", imagesCreated: 0, error: message };
  }
}

// ---------------------------------------------------------------------------
// Core: process all queued runs (one pass)
// ---------------------------------------------------------------------------

/**
 * Pick up to `limit` queued PositionRuns and process them sequentially.
 * Returns results for each processed run.
 */
export async function processQueuedRuns(limit = 5): Promise<WorkerResult[]> {
  const queuedRuns = await prisma.positionRun.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  if (queuedRuns.length === 0) {
    console.log("[worker] No queued runs found");
    return [];
  }

  console.log(`[worker] Found ${queuedRuns.length} queued runs`);
  const results: WorkerResult[] = [];

  for (const run of queuedRuns) {
    const result = await processRun(run.id);
    results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helper: update parent CompleteJob status
// ---------------------------------------------------------------------------

async function updateJobStatus(jobId: string) {
  const runs = await prisma.positionRun.findMany({
    where: { completeJobId: jobId },
    select: { status: true },
  });

  if (runs.length === 0) return;

  const allDone = runs.every((r) => r.status === "done");
  const anyFailed = runs.some((r) => r.status === "failed");
  const anyRunning = runs.some((r) => r.status === "running" || r.status === "queued");
  const someDone = runs.some((r) => r.status === "done");

  let newStatus: string;
  if (allDone) {
    newStatus = "done";
  } else if (anyFailed && !anyRunning) {
    newStatus = "failed";
  } else if (someDone && anyRunning) {
    newStatus = "partial_done";
  } else if (anyRunning) {
    newStatus = "running";
  } else {
    newStatus = "partial_done";
  }

  await prisma.completeJob.update({
    where: { id: jobId },
    data: { status: newStatus as "draft" | "queued" | "running" | "partial_done" | "done" | "failed" },
  });
}
