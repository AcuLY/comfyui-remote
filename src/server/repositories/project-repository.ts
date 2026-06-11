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
  getLatestRunsById,
  summarizeRunImages,
  serializeLatestRun,
  resolveLatestRun,
  serializeProjectSection,
  resolveSectionConfigsById,
  buildProjectLevelOverridesUpdate,
  buildResolvedConfigSnapshot,
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
  const title = filters.title?.trim();
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
      ...(title ? { title: ciContains(title) } : {}),
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
      folderId: project.folderId,
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
  const resolvedConfigsBySectionId = await resolveSectionConfigsById(
    project.sections.map((section) => section.id),
  );

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    folderId: project.folderId,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    notes: project.notes,
    sectionCount: project._count.sections,
    enabledSectionCount: project.sections.length,
    promptOverview: {
      projectLevelOverrides: project.projectLevelOverrides,
    },
    sections: project.sections.map((section) =>
      serializeProjectSection(
        section,
        latestRunsById,
        resolvedConfigsBySectionId.get(section.id),
      ),
    ),
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
      folderId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      projectLevelOverrides: true,
      checkpointName: true,
      _count: {
        select: { sections: true },
      },
      sections: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
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

  const [latestRunsById, resolvedConfigsBySectionId] = await Promise.all([
    getLatestRunsById(latestRunIds),
    resolveSectionConfigsById(project.sections.map((section) => section.id)),
  ]);
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
    const resolvedConfig = resolvedConfigsBySectionId.get(section.id);
    if (!resolvedConfig) {
      throw new Error("JOB_POSITION_CONFIG_NOT_FOUND");
    }

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
      promptBlocks: resolvedConfig.promptBlocks,
      promptDraft: resolvedConfig.prompt,
      resolvedConfig: buildResolvedConfigSnapshot(project, section, resolvedConfig),
    };
  });

  return {
    project: {
      id: project.id,
      title: project.title,
      slug: project.slug,
      folderId: project.folderId,
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
  const [latestRunsById, resolvedConfigsBySectionId] = await Promise.all([
    getLatestRunsById(latestRunIds),
    resolveSectionConfigsById([section.id]),
  ]);

  return serializeProjectSection(
    section,
    latestRunsById,
    resolvedConfigsBySectionId.get(section.id),
  );
}

export async function createProject(input: ProjectCreateInput) {
  const projectId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const slug = await resolveUniqueProjectSlug(tx, input.title);
    const createdProject = await tx.project.create({
      data: {
        title: input.title,
        slug,
        status: JobStatus.draft,
        folderId: input.folderId ?? null,
        checkpointName: input.checkpointName,
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
      checkpointName: true,
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
  if (input.checkpointName !== undefined) {
    data.checkpointName = input.checkpointName;
  }
  if (input.folderId !== undefined) {
    data.folder = input.folderId === null
      ? { disconnect: true }
      : { connect: { id: input.folderId } };
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

  if (input.aspectRatio !== undefined) {
    data.aspectRatio = input.aspectRatio;
  }

  if (input.aspectRatios !== undefined) {
    data.aspectRatios = input.aspectRatios === null
      ? Prisma.DbNull
      : JSON.parse(JSON.stringify(input.aspectRatios));
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

  if (input.checkpointName !== undefined) {
    data.checkpointName = input.checkpointName;
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
            id: true,
            sortOrder: true,
              enabled: true,
              aspectRatio: true,
              aspectRatios: true,
              shortSidePx: true,
            batchSize: true,
            // v0.3: dual seedPolicy
            seedPolicy1: true,
            seedPolicy2: true,
            // v0.3: ksampler params
            ksampler1: true,
            ksampler2: true,
            upscaleFactor: true,
            checkpointName: true,
            extraParams: true,
            presetBindingRows: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                bindingKey: true,
                categoryId: true,
                presetId: true,
                variantId: true,
                presetGroupId: true,
                groupBindingKey: true,
                sortOrder: true,
              },
            },
            sectionPromptBlocks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                sectionBindingId: true,
                type: true,
                customLabel: true,
                customPositive: true,
                customNegative: true,
                sortOrder: true,
              },
            },
            manualLoraEntries: {
              orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
              select: {
                sectionBindingId: true,
                stage: true,
                path: true,
                weight: true,
                enabled: true,
                detachedFromBindingKey: true,
                detachedFromPresetId: true,
                detachedFromVariantId: true,
                detachedFromPath: true,
                metadata: true,
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
        folderId: project.folderId,
        checkpointName: project.checkpointName,
        notes: project.notes,
        sections: {
          create: project.sections.map((section) => ({
            sortOrder: section.sortOrder,
            enabled: section.enabled,
              aspectRatio: section.aspectRatio,
              aspectRatios: cloneJsonValueForCreate(section.aspectRatios),
              shortSidePx: section.shortSidePx,
            batchSize: section.batchSize,
            seedPolicy1: section.seedPolicy1,
            seedPolicy2: section.seedPolicy2,
            ksampler1: cloneJsonValueForCreate(section.ksampler1),
            ksampler2: cloneJsonValueForCreate(section.ksampler2),
            upscaleFactor: section.upscaleFactor,
            checkpointName: section.checkpointName,
            extraParams: cloneJsonValueForCreate(section.extraParams),
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
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, sortOrder: true },
        },
      },
    });

    const copiedSectionBySourceId = new Map<string, string>();
    for (const [index, sourceSection] of project.sections.entries()) {
      const copiedSectionId = copiedProject.sections[index]?.id;
      if (copiedSectionId) copiedSectionBySourceId.set(sourceSection.id, copiedSectionId);
    }

    for (const sourceSection of project.sections) {
      const copiedSectionId = copiedSectionBySourceId.get(sourceSection.id);
      if (!copiedSectionId) continue;

      const copiedBindingIdBySourceId = new Map<string, string>();
      for (const binding of sourceSection.presetBindingRows) {
        const copiedBinding = await tx.sectionPresetBinding.create({
          data: {
            projectSectionId: copiedSectionId,
            bindingKey: binding.bindingKey,
            categoryId: binding.categoryId,
            presetId: binding.presetId,
            variantId: binding.variantId,
            presetGroupId: binding.presetGroupId,
            groupBindingKey: binding.groupBindingKey,
            sortOrder: binding.sortOrder,
          },
          select: { id: true },
        });
        copiedBindingIdBySourceId.set(binding.id, copiedBinding.id);
      }

      for (const block of sourceSection.sectionPromptBlocks) {
        await tx.sectionPromptBlock.create({
          data: {
            projectSectionId: copiedSectionId,
            sectionBindingId: block.sectionBindingId
              ? copiedBindingIdBySourceId.get(block.sectionBindingId) ?? null
              : null,
            type: block.type,
            customLabel: block.customLabel,
            customPositive: block.customPositive,
            customNegative: block.customNegative,
            sortOrder: block.sortOrder,
          },
        });
      }

      for (const entry of sourceSection.manualLoraEntries) {
        await tx.sectionManualLoraEntry.create({
          data: {
            projectSectionId: copiedSectionId,
            sectionBindingId: entry.sectionBindingId
              ? copiedBindingIdBySourceId.get(entry.sectionBindingId) ?? null
              : null,
            stage: entry.stage,
            path: entry.path,
            weight: entry.weight,
            enabled: entry.enabled,
            detachedFromBindingKey: entry.detachedFromBindingKey,
            detachedFromPresetId: entry.detachedFromPresetId,
            detachedFromVariantId: entry.detachedFromVariantId,
            detachedFromPath: entry.detachedFromPath,
            metadata: entry.metadata ?? undefined,
            sortOrder: entry.sortOrder,
          },
        });
      }
    }

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
