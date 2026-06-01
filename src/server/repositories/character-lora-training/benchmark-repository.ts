import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
  RunStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraBenchmarkTaskPayload } from "@/server/character-lora-training/contracts";
import { deleteProjectCompletely } from "@/server/services/project-deletion-service";

import {
  buildBenchmarkExtraParams,
  buildBenchmarkMatrixExpansionSummary,
  buildBenchmarkMatrixItems,
  buildBenchmarkSectionManualLoraEntries,
  buildBenchmarkSectionMetadata,
  buildBenchmarkTemplateStatus,
  buildCharacterLoraBenchmarkTemplateSections,
  decorateBenchmarkPromptBlocks,
  findPreferredCharacterLoraBenchmarkTemplate,
  normalizeOptionalTemplateCheckpointName,
  normalizeTemplatePromptBlocks,
  readNumberArrayFromJson,
  readStringArrayFromJson,
} from "./benchmark-helpers";
import {
  cloneJsonValueForRepository,
  ensurePresetCategory,
  isTemporaryBenchmarkResourceNotes,
  resolveUniquePresetSlug,
  resolveUniqueProjectSlugForRepository,
  toInputJsonValue,
} from "./helpers";
import { serializeBenchmarkRun, serializeBenchmarkTemplate, serializeGpuTaskLock } from "./serializers";
import type { CharacterLoraBenchmarkCleanupRepositoryResult } from "./serializers";
import {
  BENCHMARK_RUN_SELECT,
  BENCHMARK_TEMPLATE_SELECT,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_DESCRIPTION,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
  GPU_TASK_LOCK_SELECT,
  type CharacterLoraBenchmarkCleanupBlocker,
} from "./types";

export async function createCharacterLoraBenchmarkRunWithTask(input: {
  benchmarkRunId: string;
  jobId: string;
  trainingRunId: string;
  loraAssetId?: string | null;
  templateId?: string | null;
  checkpointMatrix: Prisma.InputJsonValue;
  weightMatrix: Prisma.InputJsonValue;
  taskPayload?: CharacterLoraBenchmarkTaskPayload | null;
  gpuLockMetadata?: Prisma.InputJsonValue | null;
  tempPreset: {
    categoryName: string;
    categorySlug: string;
    presetName: string;
    presetSlug: string;
    variantName: string;
    variantSlug: string;
    prompt: string;
    negativePrompt?: string | null;
    lora1: Prisma.InputJsonValue;
    lora2: Prisma.InputJsonValue;
    notes: string;
  };
  tempProject: {
    title: string;
    notes: string;
    checkpointName?: string | null;
    checkpointMatrix: string[];
    weightMatrix: number[];
    loraPath: string;
    promptBlock: {
      label: string;
      positive: string;
      negative?: string | null;
    };
    fallbackSections: Array<{
      name: string;
      sortOrder?: number | null;
      promptBlock: {
        label: string;
        positive: string;
        negative?: string | null;
      };
    }>;
  };
}) {
  const result = await db.$transaction(async (tx) => {
    const category = await ensurePresetCategory(tx, {
      name: input.tempPreset.categoryName,
      slug: input.tempPreset.categorySlug,
      icon: "UserRound",
      color: "78 50% 55%",
    });
    const presetSlug = await resolveUniquePresetSlug(tx, category.id, input.tempPreset.presetSlug);
    const preset = await tx.preset.create({
      data: {
        categoryId: category.id,
        name: input.tempPreset.presetName,
        slug: presetSlug,
        notes: input.tempPreset.notes,
        variants: {
          create: {
            name: input.tempPreset.variantName,
            slug: input.tempPreset.variantSlug,
            prompt: input.tempPreset.prompt,
            negativePrompt: input.tempPreset.negativePrompt ?? null,
            lora1: input.tempPreset.lora1,
            lora2: input.tempPreset.lora2,
            sortOrder: 0,
          },
        },
      },
      include: { variants: { select: { id: true, slug: true }, take: 1 } },
    });
    const variantId = preset.variants[0]?.id ?? null;
    const projectSlug = await resolveUniqueProjectSlugForRepository(tx, input.tempProject.title);
    const template = input.templateId
      ? await tx.projectTemplate.findUnique({
          where: { id: input.templateId },
          include: {
            sectionFolders: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }] },
            sections: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          },
        })
      : null;
    if (input.templateId && !template) {
      throw new Error(`Benchmark ProjectTemplate not found: ${input.templateId}`);
    }
    const project = await tx.project.create({
      data: {
        title: input.tempProject.title,
        slug: projectSlug,
        status: "draft",
        checkpointName: input.tempProject.checkpointName ?? null,
        notes: input.tempProject.notes,
        presetBindingRows: {
          create: {
            categoryId: category.id,
            presetId: preset.id,
            variantId,
            sortOrder: 0,
          },
        },
      },
      select: { id: true },
    });

    if (template) {
      const folderIdMap = new Map<string, string>();
      for (const folder of template.sectionFolders) {
        const created = await tx.projectSectionFolder.create({
          data: {
            projectId: project.id,
            parentId: folder.parentId ? folderIdMap.get(folder.parentId) ?? null : null,
            name: folder.name,
            sortOrder: folder.sortOrder,
          },
          select: { id: true },
        });
        folderIdMap.set(folder.id, created.id);
      }

      let expandedSortOrder = 0;
      for (const [index, section] of template.sections.entries()) {
        const blocks = normalizeTemplatePromptBlocks(section.promptBlocks, input.tempProject.promptBlock);
        for (const matrixItem of buildBenchmarkMatrixItems(input.tempProject.checkpointMatrix, input.tempProject.weightMatrix)) {
          const matrixMetadata = buildBenchmarkSectionMetadata({
            benchmarkRunId: input.benchmarkRunId,
            baseSectionIndex: index,
            originalSectionName: section.name ?? `Section ${index + 1}`,
            originalSortOrder: section.sortOrder ?? index,
            matrixItem,
          });
          const decoratedBlocks = decorateBenchmarkPromptBlocks(blocks, matrixMetadata);
          await tx.projectSection.create({
            data: {
              projectId: project.id,
              folderId: section.folderId ? folderIdMap.get(section.folderId) ?? null : null,
              sortOrder: expandedSortOrder,
              enabled: true,
              name: section.name,
              aspectRatio: section.aspectRatio,
              shortSidePx: section.shortSidePx,
              batchSize: section.batchSize,
              seedPolicy1: section.seedPolicy1,
              seedPolicy2: section.seedPolicy2,
              ksampler1: cloneJsonValueForRepository(section.ksampler1),
              ksampler2: cloneJsonValueForRepository(section.ksampler2),
              upscaleFactor: section.upscaleFactor,
              checkpointName: matrixItem.checkpointName,
              extraParams: buildBenchmarkExtraParams(section.extraParams, matrixMetadata),
              sectionPromptBlocks: {
                create: decoratedBlocks.map((block, blockIndex) => ({
                  type: "custom",
                  customLabel: block.label,
                  customPositive: block.positive,
                  customNegative: block.negative ?? null,
                  sortOrder: block.sortOrder ?? blockIndex,
                })),
              },
              manualLoraEntries: {
                create: buildBenchmarkSectionManualLoraEntries(input.tempProject.loraPath, matrixMetadata),
              },
            },
            select: { id: true },
          });
          expandedSortOrder += 1;
        }
      }
    } else {
      if (input.tempProject.fallbackSections.length === 0) {
        throw new Error("Benchmark fallback sections are required when no template is available.");
      }

      let expandedSortOrder = 0;
      for (const [index, section] of input.tempProject.fallbackSections.entries()) {
        const blocks = [{ ...section.promptBlock, sortOrder: 0 }];
        for (const matrixItem of buildBenchmarkMatrixItems(input.tempProject.checkpointMatrix, input.tempProject.weightMatrix)) {
          const matrixMetadata = buildBenchmarkSectionMetadata({
            benchmarkRunId: input.benchmarkRunId,
            baseSectionIndex: index,
            originalSectionName: section.name,
            originalSortOrder: section.sortOrder ?? index,
            matrixItem,
          });
          const decoratedBlocks = decorateBenchmarkPromptBlocks(blocks, matrixMetadata);
          await tx.projectSection.create({
            data: {
              projectId: project.id,
              sortOrder: expandedSortOrder,
              enabled: true,
              name: section.name,
              checkpointName: matrixItem.checkpointName,
              extraParams: buildBenchmarkExtraParams(null, matrixMetadata),
              sectionPromptBlocks: {
                create: decoratedBlocks.map((block, blockIndex) => ({
                  type: "custom",
                  customLabel: block.label,
                  customPositive: block.positive,
                  customNegative: block.negative ?? null,
                  sortOrder: block.sortOrder ?? blockIndex,
                })),
              },
              manualLoraEntries: {
                create: buildBenchmarkSectionManualLoraEntries(input.tempProject.loraPath, matrixMetadata),
              },
            },
            select: { id: true },
          });
          expandedSortOrder += 1;
        }
      }
    }

    const run = await tx.characterLoraBenchmarkRun.create({
      data: {
        id: input.benchmarkRunId,
        jobId: input.jobId,
        trainingRunId: input.trainingRunId,
        status: CharacterLoraRunStatus.queued,
        loraAssetId: input.loraAssetId ?? null,
        testPresetId: preset.id,
        testProjectId: project.id,
        templateId: template?.id ?? null,
        checkpointMatrix: input.checkpointMatrix,
        weightMatrix: input.weightMatrix,
      },
      select: BENCHMARK_RUN_SELECT,
    });

    const task = input.taskPayload
      ? await tx.characterLoraWorkerTask.create({
          data: {
            jobId: input.jobId,
            workerType: CharacterLoraWorkerType.benchmark,
            targetType: "benchmarkRun",
            targetId: run.id,
            status: CharacterLoraRunStatus.queued,
            payload: toInputJsonValue(input.taskPayload),
          },
          select: { id: true },
        })
      : null;
    const gpuLock = input.taskPayload
      ? await tx.gpuTaskLock.create({
          data: {
            taskType: "benchmark",
            ownerType: "character_lora_benchmark_run",
            ownerId: run.id,
            status: "active",
            metadata: input.gpuLockMetadata ?? Prisma.DbNull,
          },
          select: GPU_TASK_LOCK_SELECT,
        })
      : null;

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.benchmarking,
        phase: "benchmark",
        failureSummary: null,
      },
      select: { id: true },
    });

    return { run, taskId: task?.id ?? null, gpuLock, testPresetId: preset.id, testProjectId: project.id };
  });

  return {
    benchmarkRun: serializeBenchmarkRun(result.run),
    workerTaskId: result.taskId,
    gpuTaskLock: result.gpuLock ? serializeGpuTaskLock(result.gpuLock) : null,
    testPresetId: result.testPresetId,
    testProjectId: result.testProjectId,
  };
}

export async function listCharacterLoraBenchmarkRunsByJob(jobId: string) {
  const runs = await db.characterLoraBenchmarkRun.findMany({
    where: { jobId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: BENCHMARK_RUN_SELECT,
  });

  return runs.map(serializeBenchmarkRun);
}

export async function listCharacterLoraBenchmarkRunsByTrainingRun(trainingRunId: string) {
  const runs = await db.characterLoraBenchmarkRun.findMany({
    where: { trainingRunId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: BENCHMARK_RUN_SELECT,
  });

  return runs.map(serializeBenchmarkRun);
}

export async function getCharacterLoraBenchmarkRun(benchmarkRunId: string) {
  const run = await db.characterLoraBenchmarkRun.findUnique({
    where: { id: benchmarkRunId },
    select: BENCHMARK_RUN_SELECT,
  });

  return run ? serializeBenchmarkRun(run) : null;
}

export async function getCharacterLoraBenchmarkMatrixExpansionSummary(benchmarkRunId: string) {
  const benchmark = await db.characterLoraBenchmarkRun.findUnique({
    where: { id: benchmarkRunId },
    select: {
      testProjectId: true,
      checkpointMatrix: true,
      weightMatrix: true,
    },
  });
  if (!benchmark?.testProjectId) {
    return null;
  }

  const sections = await db.projectSection.findMany({
    where: { projectId: benchmark.testProjectId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      checkpointName: true,
      loraConfig: true,
      extraParams: true,
      sectionPromptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          customLabel: true,
          customPositive: true,
        },
      },
      manualLoraEntries: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          weight: true,
          enabled: true,
          metadata: true,
        },
      },
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          label: true,
          positive: true,
        },
      },
    },
  });

  return buildBenchmarkMatrixExpansionSummary({
    checkpointMatrix: readStringArrayFromJson(benchmark.checkpointMatrix),
    weightMatrix: readNumberArrayFromJson(benchmark.weightMatrix),
    sections,
  });
}

export async function completeCharacterLoraBenchmarkRunInRepository(input: {
  benchmarkRunId: string;
  reportArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata?: Prisma.InputJsonValue | null;
  };
  recommendedWeight: number;
  resultSummary: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const run = await tx.characterLoraBenchmarkRun.findUnique({
      where: { id: input.benchmarkRunId },
      select: { id: true, jobId: true },
    });
    if (!run) return null;

    const artifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: run.jobId,
        kind: "benchmark_report",
        relativePath: input.reportArtifact.relativePath,
        absolutePath: input.reportArtifact.absolutePath,
        sha256: input.reportArtifact.sha256,
        byteSize: input.reportArtifact.byteSize,
        mimeType: "application/json",
        redactionLevel: "path_only",
        metadata: input.reportArtifact.metadata ?? Prisma.DbNull,
      },
      select: { id: true },
    });

    await tx.characterLoraWorkerTask.updateMany({
      where: {
        targetType: "benchmarkRun",
        targetId: run.id,
        status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
      },
      data: {
        status: CharacterLoraRunStatus.done,
        finishedAt: new Date(),
        heartbeatAt: new Date(),
        leaseExpiresAt: null,
        progressJson: toInputJsonValue({ completed: true, reportArtifactId: artifact.id }),
        errorSummary: null,
      },
    });

    await tx.gpuTaskLock.updateMany({
      where: {
        ownerType: "character_lora_benchmark_run",
        ownerId: run.id,
        status: "active",
      },
      data: {
        status: "released",
        releasedAt: new Date(),
      },
    });

    const updated = await tx.characterLoraBenchmarkRun.update({
      where: { id: run.id },
      data: {
        status: CharacterLoraRunStatus.done,
        reportArtifactId: artifact.id,
        recommendedWeight: input.recommendedWeight,
        resultSummary: input.resultSummary,
        finishedAt: new Date(),
      },
      select: BENCHMARK_RUN_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: run.jobId },
      data: {
        status: CharacterLoraJobStatus.benchmark_review,
        phase: "benchmark",
        failureSummary: null,
      },
      select: { id: true },
    });

    return updated;
  });

  return result ? serializeBenchmarkRun(result) : null;
}

export async function cleanupCharacterLoraBenchmarkTemporaryResourcesInRepository(input: {
  benchmarkRunId: string;
  cleanupProject: boolean;
  cleanupPreset: boolean;
  dryRun: boolean;
  cleanedAt?: Date;
}): Promise<CharacterLoraBenchmarkCleanupRepositoryResult | null> {
  const cleanedAt = input.cleanedAt ?? new Date();
  const cleanedAtIso = cleanedAt.toISOString();

  const plan = await db.$transaction(async (tx) => {
    const run = await tx.characterLoraBenchmarkRun.findUnique({
      where: { id: input.benchmarkRunId },
      select: BENCHMARK_RUN_SELECT,
    });
    if (!run) return null;

    const blockers: CharacterLoraBenchmarkCleanupBlocker[] = [];
    const projectState: Record<string, unknown> = {
      requested: input.cleanupProject,
      id: run.testProjectId,
      cleanedAt: run.testProjectCleanedAt?.toISOString() ?? null,
      action: input.cleanupProject ? "pending" : "skipped_by_request",
    };
    const presetState: Record<string, unknown> = {
      requested: input.cleanupPreset,
      id: run.testPresetId,
      cleanedAt: run.testPresetCleanedAt?.toISOString() ?? null,
      action: input.cleanupPreset ? "pending" : "skipped_by_request",
    };

    if (input.cleanupProject) {
      if (!run.testProjectId) {
        projectState.action = "missing_reference";
      } else if (run.testProjectCleanedAt) {
        projectState.action = "already_cleaned";
      } else {
        const project = await tx.project.findUnique({
          where: { id: run.testProjectId },
          select: { id: true, title: true, notes: true },
        });
        projectState.exists = Boolean(project);
        projectState.title = project?.title ?? null;

        if (!project) {
          projectState.action = "already_missing";
        } else if (!isTemporaryBenchmarkResourceNotes(project.notes)) {
          projectState.action = "blocked_not_temporary";
          blockers.push({
            code: "project_not_temporary",
            message: "Benchmark test project notes do not mark it as a temporary benchmark resource",
            details: { projectId: project.id, benchmarkRunId: run.id },
          });
        } else {
          projectState.action = "delete";
        }
      }
    }

    if (input.cleanupPreset) {
      if (!run.testPresetId) {
        presetState.action = "missing_reference";
      } else if (run.testPresetCleanedAt) {
        presetState.action = "already_cleaned";
      } else {
        const preset = await tx.preset.findUnique({
          where: { id: run.testPresetId },
          select: { id: true, name: true, notes: true },
        });
        presetState.exists = Boolean(preset);
        presetState.name = preset?.name ?? null;

        if (!preset) {
          presetState.action = "already_missing";
        } else if (!isTemporaryBenchmarkResourceNotes(preset.notes)) {
          presetState.action = "blocked_not_temporary";
          blockers.push({
            code: "preset_not_temporary",
            message: "Benchmark test preset notes do not mark it as a temporary benchmark resource",
            details: { presetId: preset.id, benchmarkRunId: run.id },
          });
        } else {
          presetState.action = "delete";
        }
      }
    }

    const summary: Record<string, unknown> = {
      requestedAt: cleanedAtIso,
      dryRun: input.dryRun,
      requested: {
        project: input.cleanupProject,
        preset: input.cleanupPreset,
      },
      preserved: {
        benchmarkRunId: run.id,
        jobId: run.jobId,
        trainingRunId: run.trainingRunId,
        loraAssetId: run.loraAssetId,
        reportArtifactId: run.reportArtifactId,
        testPresetId: run.testPresetId,
        testProjectId: run.testProjectId,
      },
      project: projectState,
      preset: presetState,
    };

    if (blockers.length > 0 || input.dryRun) {
      return {
        kind: "result" as const,
        result: {
          benchmarkRun: serializeBenchmarkRun(run),
          cleanup: summary,
          blockers,
          dryRun: input.dryRun,
          canCleanup: blockers.length === 0,
        },
      };
    }

    return {
      kind: "cleanup" as const,
      run,
      summary,
      projectState,
      presetState,
    };
  });

  if (!plan) return null;
  if (plan.kind === "result") return plan.result;

  const { run, summary, projectState, presetState } = plan;
  const updateData: Prisma.CharacterLoraBenchmarkRunUpdateInput = {
    cleanupSummary: toInputJsonValue(summary),
  };

  if (projectState.action === "delete" && run.testProjectId) {
    const deletion = await deleteProjectCompletely(run.testProjectId);
    projectState.action = deletion.deletedProject ? "deleted" : "already_missing";
    projectState.deletedCount = deletion.deletedProject ? 1 : 0;
    projectState.cancelledRuns = deletion.cancelledRuns;
    projectState.cancelledCensoringTasks = deletion.cancelledCensoringTasks;
    projectState.deletedManagedDir = deletion.deletedManagedDir;
    projectState.deletedExportDir = deletion.deletedExportDir;
    projectState.deletedTrashFiles = deletion.deletedTrashFiles;
    projectState.deletedComfyDirs = deletion.deletedComfyDirs;
    updateData.testProjectCleanedAt = cleanedAt;
  } else if (projectState.action === "already_missing") {
    updateData.testProjectCleanedAt = cleanedAt;
  }

  const updated = await db.$transaction(async (tx) => {
    if (presetState.action === "delete" && run.testPresetId) {
      const deletion = await tx.preset.deleteMany({ where: { id: run.testPresetId } });
      presetState.action = deletion.count > 0 ? "deleted" : "already_missing";
      presetState.deletedCount = deletion.count;
      updateData.testPresetCleanedAt = cleanedAt;
    } else if (presetState.action === "already_missing") {
      updateData.testPresetCleanedAt = cleanedAt;
    }

    summary.completedAt = cleanedAtIso;
    updateData.cleanupSummary = toInputJsonValue(summary);

    const updated = await tx.characterLoraBenchmarkRun.update({
      where: { id: run.id },
      data: updateData,
      select: BENCHMARK_RUN_SELECT,
    });
    return updated;
  });

  return {
    benchmarkRun: serializeBenchmarkRun(updated),
    cleanup: summary,
    blockers: [],
    dryRun: false,
    canCleanup: true,
  };
}

export async function findCharacterLoraBenchmarkTemplate() {
  const template = await findPreferredCharacterLoraBenchmarkTemplate();
  return template ? serializeBenchmarkTemplate(template) : null;
}

export async function getCharacterLoraBenchmarkTemplateStatusInRepository() {
  const template = await findPreferredCharacterLoraBenchmarkTemplate();
  return buildBenchmarkTemplateStatus(template ? serializeBenchmarkTemplate(template) : null);
}

export async function ensureCharacterLoraBenchmarkTemplateInRepository(input: {
  checkpointName?: string | null;
} = {}) {
  const checkpointName = normalizeOptionalTemplateCheckpointName(input.checkpointName);
  const result = await db.$transaction(async (tx) => {
    const existing = await findPreferredCharacterLoraBenchmarkTemplate(tx);

    if (existing) {
      return {
        result: "found" as const,
        template: serializeBenchmarkTemplate(existing),
      };
    }

    const created = await tx.projectTemplate.create({
      data: {
        name: CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME,
        description: CHARACTER_LORA_BENCHMARK_TEMPLATE_DESCRIPTION,
        presetBindings: toInputJsonValue([]),
        sections: {
          create: buildCharacterLoraBenchmarkTemplateSections(checkpointName),
        },
      },
      select: BENCHMARK_TEMPLATE_SELECT,
    });

    return {
      result: "created" as const,
      template: serializeBenchmarkTemplate(created),
    };
  });

  return {
    ...result,
    created: result.result === "created",
    found: result.result === "found",
    requiredTemplateNames: [...CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS],
    requiredSectionCount: CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
  };
}

export async function getCharacterLoraBenchmarkTemplateById(templateId: string) {
  const template = await db.projectTemplate.findUnique({
    where: { id: templateId },
    select: BENCHMARK_TEMPLATE_SELECT,
  });

  return template ? serializeBenchmarkTemplate(template) : null;
}

export async function countActiveComfyQueueRuns() {
  const [queued, running] = await Promise.all([
    db.run.count({ where: { status: RunStatus.queued } }),
    db.run.count({ where: { status: RunStatus.running } }),
  ]);

  return { queued, running };
}

export async function listActiveCharacterLoraGpuTaskLocks() {
  const locks = await db.gpuTaskLock.findMany({
    where: { status: "active" },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: GPU_TASK_LOCK_SELECT,
  });

  return locks.map(serializeGpuTaskLock);
}

export async function getCurrentCharacterLoraGpuTaskLock() {
  const lock = await db.gpuTaskLock.findFirst({
    where: { status: "active" },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: GPU_TASK_LOCK_SELECT,
  });

  return lock ? serializeGpuTaskLock(lock) : null;
}
