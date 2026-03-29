/**
 * Revision Service
 *
 * Captures snapshots of a Project before it is modified.
 * Each snapshot is stored as a ProjectRevision record with an incrementing
 * revisionNumber and the full project state at that point in time.
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
  projectLevelOverrides: true,
  notes: true,
  sections: {
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
 * Create a revision snapshot of the current project state before an update.
 * Returns the created revision or null if snapshot failed.
 */
export async function createProjectRevision(
  projectId: string,
  actorType: ActorType = ActorType.user,
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: JOB_SNAPSHOT_SELECT,
    });

    if (!project) return null;

    // Determine next revision number
    const latestRevision = await prisma.projectRevision.findFirst({
      where: { projectId: projectId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });

    const nextRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

    // Store snapshot
    return prisma.projectRevision.create({
      data: {
        projectId: projectId,
        revisionNumber: nextRevisionNumber,
        snapshot: JSON.parse(JSON.stringify(project)) as object,
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
 * List revisions for a project (newest first).
 */
export async function listProjectRevisions(projectId: string, limit = 50) {
  return prisma.projectRevision.findMany({
    where: { projectId: projectId },
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
export async function getProjectRevision(projectId: string, revisionNumber: number) {
  return prisma.projectRevision.findUnique({
    where: {
      projectId_revisionNumber: {
        projectId: projectId,
        revisionNumber,
      },
    },
  });
}
