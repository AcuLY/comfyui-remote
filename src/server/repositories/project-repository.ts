import { Prisma } from "@/generated/prisma";
import { JobStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { detectProvider } from "@/lib/prisma";
import {
  type ProjectUpdateInput,
  type ProjectCreateInput,
  type ProjectSectionUpdateInput,
  type ListProjectsFilters,
  type ProjectCreateOptions,
  type LatestRunRecord,
  type QueuableProjectRecord,
  getLatestRunsById,
  summarizeRunImages,
  serializeLatestRun,
  resolveLatestRun,
  serializeProjectSection,
  buildProjectLevelOverridesUpdate,
  buildResolvedConfigSnapshot,
  buildResolvedPromptDraft,
  cloneJsonValueForCreate,
  resolveUniqueProjectSlug,
  resolveUniqueProjectCopyIdentity,
} from "./project-repository/helpers";
export type {
  ProjectUpdateInput,
  ProjectCreateInput,
  ProjectSectionUpdateInput,
  ListProjectsFilters,
  ProjectCreateOptions,
} from "./project-repository/helpers";
export { enqueueProjectRuns, enqueueProjectSectionRun } from "./project-repository/enqueue";

export async function listProjects(filters: ListProjectsFilters = {}) {
  const search = filters.search?.trim();
  // SQLite LIKE is case-insensitive for ASCII by default;
  // PostgreSQL requires explicit mode: "insensitive".
  const ciContains = (value: string) =>
    detectProvider() === "postgresql"
      ? { contains: value, mode: "insensitive" as const }
      : { contains: value };

  const projects = await db.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { title: ciContains(search) },
              { slug: ciContains(search) },
            ],
          }
        : {}),
      ...(filters.enabledOnly
        ? {
            sections: {
              some: {
                enabled: true,
              },
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      sections: {
        select: {
          id: true,
          enabled: true,
          latestRunId: true,
        },
      },
    },
    take: 50,
  });

  const latestRunIds = projects.flatMap((project) =>
    project.sections
      .map((section) => section.latestRunId)
      .filter((runId): runId is string => runId !== null),
  );

  const latestRunsById = await getLatestRunsById(latestRunIds);

  const serializedProjects = projects.map((project) => {
    const latestRun = project.sections
      .map((section) => (section.latestRunId ? latestRunsById.get(section.latestRunId) ?? null : null))
      .filter((run): run is LatestRunRecord => run !== null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

    const latestRunSummary = latestRun ? summarizeRunImages(latestRun.images) : null;

    return {
      id: project.id,
      title: project.title,
      status: project.status,
      updatedAt: project.updatedAt.toISOString(),
      sectionCount: project.sections.length,
      enabledSectionCount: project.sections.filter((section) => section.enabled).length,
      latestRunAt: latestRun?.createdAt.toISOString() ?? null,
      latestRunStatus: latestRun?.status ?? null,
      latestRunPendingCount: latestRunSummary?.pendingCount ?? 0,
      latestRunTotalCount: latestRunSummary?.totalCount ?? 0,
    };
  });

  if (filters.hasPending) {
    return serializedProjects.filter((project) => project.latestRunPendingCount > 0);
  }

  return serializedProjects;
}

export async function getProjectDetail(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: { sections: true },
      },
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

  const latestRunIds = project.sections
    .map((section) => section.latestRunId)
    .filter((runId): runId is string => runId !== null);

  const latestRunsById = await getLatestRunsById(latestRunIds);

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    notes: project.notes,
    sectionCount: project._count.sections,
    enabledSectionCount: project.sections.length,
    promptOverview: {
      projectLevelOverrides: project.projectLevelOverrides,
    },
    sections: project.sections.map((section) => serializeProjectSection(section, latestRunsById)),
  };
}

export async function getProjectAgentContext(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      projectLevelOverrides: true,
      _count: {
        select: { sections: true },
      },
      sections: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          promptBlocks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              type: true,
              sourceId: true,
              categoryId: true,
              label: true,
              positive: true,
              negative: true,
              sortOrder: true,
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

  const latestRunIds = project.sections
    .map((section) => section.latestRunId)
    .filter((runId): runId is string => runId !== null);

  const latestRunsById = await getLatestRunsById(latestRunIds);
  const latestRunStatusCounts: Record<string, number> = {};
  const latestRunImageSummary = {
    totalCount: 0,
    pendingCount: 0,
    keptCount: 0,
    trashedCount: 0,
  };
  let positionsWithLatestRunCount = 0;

  const sections = project.sections.map((section) => {
    const latestRun = resolveLatestRun(section, latestRunsById);

    if (latestRun) {
      positionsWithLatestRunCount += 1;
      latestRunStatusCounts[latestRun.status] =
        (latestRunStatusCounts[latestRun.status] ?? 0) + 1;

      const imageSummary = summarizeRunImages(latestRun.images);
      latestRunImageSummary.totalCount += imageSummary.totalCount;
      latestRunImageSummary.pendingCount += imageSummary.pendingCount;
      latestRunImageSummary.keptCount += imageSummary.keptCount;
      latestRunImageSummary.trashedCount += imageSummary.trashedCount;
    }

    return {
      id: section.id,
      sortOrder: section.sortOrder,
      enabled: section.enabled,
      latestRunId: section.latestRunId,
      name: section.name ?? null,
      slug: null,
      latestRun: serializeLatestRun(latestRun),
      promptBlocks: section.promptBlocks,
      promptDraft: buildResolvedPromptDraft(project, section, section.promptBlocks),
      resolvedConfig: buildResolvedConfigSnapshot(project, section, section.promptBlocks),
    };
  });

  return {
    project: {
      id: project.id,
      title: project.title,
      slug: project.slug,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      notes: project.notes,
      sectionCount: project._count.sections,
      enabledSectionCount: project.sections.length,
      promptOverview: {
        projectLevelOverrides: project.projectLevelOverrides,
      },
    },
    summary: {
      positionsWithLatestRunCount,
      positionsWithoutRunsCount: project.sections.length - positionsWithLatestRunCount,
      latestRunStatusCounts,
      latestRunImageSummary,
    },
    sections,
  };
}

export async function getProjectSectionOwner(sectionId: string) {
  const section = await db.projectSection.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      projectId: true,
      enabled: true,
    },
  });

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  return {
    id: section.id,
    projectId: section.projectId,
    enabled: section.enabled,
  };
}

export async function getProjectSectionDetail(projectId: string, sectionId: string) {
  const section = await db.projectSection.findFirst({
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

  const latestRunIds = section.latestRunId ? [section.latestRunId] : [];
  const latestRunsById = await getLatestRunsById(latestRunIds);

  return serializeProjectSection(section, latestRunsById);
}

export async function createProject(input: ProjectCreateInput) {
  const projectId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const slug = await resolveUniqueProjectSlug(tx, input.title);
    const createdProject = await tx.project.create({
      data: {
        title: input.title,
        slug,
        status: JobStatus.draft,
        notes: input.notes,
      },
      select: {
        id: true,
      },
    });

    return createdProject.id;
  });

  return getProjectDetail(projectId);
}

export async function updateProject(projectId: string, input: ProjectUpdateInput) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectLevelOverrides: true,
    },
  });

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const data: Prisma.ProjectUpdateInput = {};

  const projectLevelOverrides = buildProjectLevelOverridesUpdate(project.projectLevelOverrides, input);
  if (projectLevelOverrides !== undefined) {
    data.projectLevelOverrides = projectLevelOverrides;
  }

  await db.project.update({
    where: { id: projectId },
    data,
  });

  return getProjectDetail(projectId);
}

export async function updateProjectSection(
  projectId: string,
  sectionId: string,
  input: ProjectSectionUpdateInput,
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const section = await db.projectSection.findFirst({
    where: {
      id: sectionId,
      projectId: projectId,
    },
    select: { id: true },
  });

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const data: Prisma.ProjectSectionUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.positivePrompt !== undefined) {
    data.positivePrompt = input.positivePrompt;
  }

  if (input.negativePrompt !== undefined) {
    data.negativePrompt = input.negativePrompt;
  }

  if (input.aspectRatio !== undefined) {
    data.aspectRatio = input.aspectRatio;
  }

  if (input.shortSidePx !== undefined) {
    data.shortSidePx = input.shortSidePx;
  }

  if (input.batchSize !== undefined) {
    data.batchSize = input.batchSize;
  }

  // v0.3: dual seedPolicy
  if (input.seedPolicy1 !== undefined) {
    data.seedPolicy1 = input.seedPolicy1;
  }
  if (input.seedPolicy2 !== undefined) {
    data.seedPolicy2 = input.seedPolicy2;
  }
  // v0.3: ksampler params
  if (input.ksampler1 !== undefined) {
    data.ksampler1 = input.ksampler1 ? JSON.parse(JSON.stringify(input.ksampler1)) : null;
  }
  if (input.ksampler2 !== undefined) {
    data.ksampler2 = input.ksampler2 ? JSON.parse(JSON.stringify(input.ksampler2)) : null;
  }
  if (input.upscaleFactor !== undefined) {
    data.upscaleFactor = input.upscaleFactor;
  }

  if (input.loraConfig !== undefined) {
    data.loraConfig = input.loraConfig
      ? (JSON.parse(JSON.stringify(input.loraConfig)) as Prisma.InputJsonValue)
      : Prisma.DbNull;
  }

  await db.projectSection.update({
    where: { id: sectionId },
    data,
  });

  return getProjectSectionDetail(projectId, sectionId);
}

export async function copyProject(projectId: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        sections: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            sortOrder: true,
            enabled: true,
            positivePrompt: true,
            negativePrompt: true,
            aspectRatio: true,
            batchSize: true,
            // v0.3: dual seedPolicy
            seedPolicy1: true,
            seedPolicy2: true,
            // v0.3: ksampler params
            ksampler1: true,
            ksampler2: true,
            upscaleFactor: true,
            loraConfig: true,
            extraParams: true,
            promptBlocks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                type: true,
                sourceId: true,
                label: true,
                positive: true,
                negative: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new Error("JOB_NOT_FOUND");
    }

    const identity = await resolveUniqueProjectCopyIdentity(tx, project);
    const copiedProject = await tx.project.create({
      data: {
        title: identity.title,
        slug: identity.slug,
        status: JobStatus.draft,
        projectLevelOverrides: cloneJsonValueForCreate(project.projectLevelOverrides),
        notes: project.notes,
        presetBindings: cloneJsonValueForCreate(project.presetBindings),
        sections: {
          create: project.sections.map((section) => ({
            sortOrder: section.sortOrder,
            enabled: section.enabled,
            positivePrompt: section.positivePrompt,
            negativePrompt: section.negativePrompt,
            aspectRatio: section.aspectRatio,
            batchSize: section.batchSize,
            seedPolicy1: section.seedPolicy1,
            seedPolicy2: section.seedPolicy2,
            ksampler1: cloneJsonValueForCreate(section.ksampler1),
            ksampler2: cloneJsonValueForCreate(section.ksampler2),
            loraConfig: cloneJsonValueForCreate(section.loraConfig),
            extraParams: cloneJsonValueForCreate(section.extraParams),
            promptBlocks: {
              create: section.promptBlocks.map((block) => ({
                type: block.type,
                sourceId: block.sourceId,
                label: block.label,
                positive: block.positive,
                negative: block.negative,
                sortOrder: block.sortOrder,
              })),
            },
          })),
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        sections: {
          select: { id: true },
        },
      },
    });

    return {
      id: copiedProject.id,
      title: copiedProject.title,
      slug: copiedProject.slug,
      status: copiedProject.status,
      createdAt: copiedProject.createdAt.toISOString(),
      sectionCount: copiedProject.sections.length,
    };
  });
}

export async function getProjectCreateOptions(): Promise<ProjectCreateOptions> {
  return {};
}
