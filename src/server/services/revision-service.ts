/**
 * Revision Service
 *
 * Captures snapshots of a CompleteJob before it is modified.
 * Each snapshot is stored as a JobRevision record with an incrementing
 * revisionNumber and the full job state at that point in time.
 *
 * Snapshot creation is best-effort — it should not block the update.
 */

import { ActorType } from "@/lib/db-enums";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Snapshot creation
// ---------------------------------------------------------------------------

const JOB_SNAPSHOT_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  characterId: true,
  scenePresetId: true,
  stylePresetId: true,
  characterPrompt: true,
  characterLoraPath: true,
  scenePrompt: true,
  stylePrompt: true,
  jobLevelOverrides: true,
  notes: true,
  positions: {
    select: {
      id: true,
      positionTemplateId: true,
      sortOrder: true,
      enabled: true,
      positivePrompt: true,
      negativePrompt: true,
      aspectRatio: true,
      batchSize: true,
      seedPolicy1: true,
      seedPolicy2: true,
      ksampler1: true,
      ksampler2: true,
      loraConfig: true,
      extraParams: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

/**
 * Create a revision snapshot of the current job state before an update.
 * Returns the created revision or null if snapshot failed.
 */
export async function createJobRevision(
  jobId: string,
  actorType: ActorType = ActorType.user,
) {
  try {
    const job = await prisma.completeJob.findUnique({
      where: { id: jobId },
      select: JOB_SNAPSHOT_SELECT,
    });

    if (!job) return null;

    // Determine next revision number
    const latestRevision = await prisma.jobRevision.findFirst({
      where: { completeJobId: jobId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });

    const nextRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

    // Store snapshot
    return prisma.jobRevision.create({
      data: {
        completeJobId: jobId,
        revisionNumber: nextRevisionNumber,
        snapshot: JSON.parse(JSON.stringify(job)) as object,
        actorType,
      },
    });
  } catch {
    // Best-effort — don't block the caller
    return null;
  }
}

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

/**
 * List revisions for a job (newest first).
 */
export async function listJobRevisions(jobId: string, limit = 50) {
  return prisma.jobRevision.findMany({
    where: { completeJobId: jobId },
    orderBy: { revisionNumber: "desc" },
    take: Math.min(limit, 200),
    select: {
      id: true,
      revisionNumber: true,
      actorType: true,
      createdAt: true,
    },
  });
}

/**
 * Get a specific revision snapshot.
 */
export async function getJobRevision(jobId: string, revisionNumber: number) {
  return prisma.jobRevision.findUnique({
    where: {
      completeJobId_revisionNumber: {
        completeJobId: jobId,
        revisionNumber,
      },
    },
  });
}
