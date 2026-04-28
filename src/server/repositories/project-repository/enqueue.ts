import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import {
  type QueuableProjectRecord,
  type ProjectSectionRecord,
  ensureQueuedProjectStatus,
  createQueuedRunsForPositions,
} from "./helpers";

export async function enqueueProjectRuns(projectId: string, overrideBatchSize?: number) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        projectLevelOverrides: true,
        sections: {
          where: { enabled: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            promptBlocks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                positive: true,
                negative: true,
              },
            },
            runs: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              select: {
                id: true,
                runIndex: true,
                status: true,
                createdAt: true,
                startedAt: true,
                finishedAt: true,
                outputDir: true,
                errorMessage: true,
                images: {
                  select: {
                    reviewStatus: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new Error("JOB_NOT_FOUND");
    }

    if (project.sections.length === 0) {
      throw new Error("JOB_HAS_NO_ENABLED_POSITIONS");
    }

    const runs = await createQueuedRunsForPositions(tx, project, project.sections, overrideBatchSize);
    const projectStatus = await ensureQueuedProjectStatus(tx, project);

    return {
      projectId: project.id,
      projectTitle: project.title,
      projectStatus,
      queuedRunCount: runs.length,
      runs,
    };
  });
}

export async function enqueueProjectSectionRun(projectId: string, sectionId: string, overrideBatchSize?: number) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        projectLevelOverrides: true,
      },
    });

    if (!project) {
      throw new Error("JOB_NOT_FOUND");
    }

    const section = await tx.projectSection.findFirst({
      where: {
        id: sectionId,
        projectId: projectId,
      },
      include: {
        promptBlocks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            positive: true,
            negative: true,
          },
        },
        runs: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            runIndex: true,
            status: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
            outputDir: true,
            errorMessage: true,
            images: {
              select: {
                reviewStatus: true,
              },
            },
          },
        },
      },
    });

    if (!section) {
      throw new Error("JOB_POSITION_NOT_FOUND");
    }

    if (!section.enabled) {
      throw new Error("JOB_POSITION_DISABLED");
    }

    const runs = await createQueuedRunsForPositions(tx, project, [section], overrideBatchSize);
    const projectStatus = await ensureQueuedProjectStatus(tx, project);

    return {
      projectId: project.id,
      projectTitle: project.title,
      projectStatus,
      queuedRunCount: runs.length,
      runs,
    };
  });
}
