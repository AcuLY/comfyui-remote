import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TRAINING_IMAGE_GENERATION_PROVIDER_POLICY } from "@/lib/training/provider-policy";
import { slugifyForTrainingRepository } from "@/server/repositories/training/helpers";

export const TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE = "source";

type JsonObject = Record<string, unknown>;

type FileLike = {
  arrayBuffer(): Promise<ArrayBuffer>;
  name: string;
  size?: number;
  type?: string;
};

export type TrainingProviderInputImage = {
  artifactId?: string;
  id?: string;
  relativePath: string;
  role?: string;
  sha256?: string | null;
};

export type TrainingProjectSectionInput = {
  blocks?: Array<{
    id?: string;
    source?: string;
    text?: string;
    title?: string;
  }>;
  enabled?: boolean;
  id?: string;
  resolvedScene?: string;
  sortOrder?: number;
  title?: string;
};

export class TrainingRepositoryError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRepositoryError";
    this.status = status;
    this.details = details;
  }
}

const trainingProjectInclude = {
  profile: true,
} satisfies Prisma.TrainingProjectInclude;

const candidateImageInclude = {
  artifact: true,
  datasetItems: {
    include: {
      revision: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 1,
  },
  generationTaskOutput: true,
  sectionRun: {
    include: {
      section: true,
    },
  },
} satisfies Prisma.TrainingImageResultInclude;

const sectionInclude = {
  blocks: {
    orderBy: [
      { sortOrder: "asc" as const },
      { createdAt: "asc" as const },
    ],
  },
  runs: {
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 1,
  },
} satisfies Prisma.TrainingSectionInclude;

const PUBLIC_SECTION_ID_KEY = "publicSectionId";
const PUBLIC_BLOCK_IDS_KEY = "publicBlockIds";
const RESOLVED_SCENE_KEY = "resolvedScene";

function isFileLike(value: unknown): value is FileLike {
  return Boolean(
    value
    && typeof value === "object"
    && "name" in value
    && typeof (value as { name?: unknown }).name === "string"
    && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function",
  );
}

function nowStorageStamp() {
  return `${Date.now()}-${randomUUID()}`;
}

function normalizeUploadName(name: string) {
  const ext = extname(name) || ".png";
  const stem = basename(name, ext)
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
  return `${stem}${ext.toLowerCase()}`;
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || typeof value === "undefined") return {};
  if (typeof value === "object") return value as Prisma.InputJsonValue;
  return { value } as Prisma.InputJsonValue;
}

function parseJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function getPublicSectionId(section: { id: string; sectionDefaultsJson?: unknown }) {
  return normalizeNullableString(parseJsonObject(section.sectionDefaultsJson)[PUBLIC_SECTION_ID_KEY]) ?? section.id;
}

function buildSectionDefaults(input: {
  publicBlockIds?: Record<string, string>;
  publicSectionId?: string | null;
  resolvedScene?: string | null;
}) {
  const defaults: JsonObject = {};
  const publicSectionId = normalizeNullableString(input.publicSectionId);
  if (publicSectionId) defaults[PUBLIC_SECTION_ID_KEY] = publicSectionId;
  const resolvedScene = normalizeNullableString(input.resolvedScene);
  if (resolvedScene) defaults[RESOLVED_SCENE_KEY] = resolvedScene;
  if (input.publicBlockIds && Object.keys(input.publicBlockIds).length > 0) {
    defaults[PUBLIC_BLOCK_IDS_KEY] = input.publicBlockIds;
  }
  return Object.keys(defaults).length > 0 ? defaults as Prisma.InputJsonValue : Prisma.JsonNull;
}

function normalizeReviewStatus(value: unknown) {
  if (value === "keep" || value === "kept" || value === "included_in_training") return "keep";
  if (value === "reject" || value === "rejected" || value === "excluded") return "reject";
  return "pending";
}

function normalizeRunStatus(status: string) {
  if (status === "completed" || status === "succeeded" || status === "done") return "done";
  if (status === "running") return "running";
  if (status === "queued") return "queued";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  return "failed";
}

function formatArtifactRoot() {
  return join(process.cwd(), "data", "images", "training");
}

function serializeFileSize(value: bigint | number | null | undefined) {
  if (value === null || typeof value === "undefined") return null;
  return Number(value);
}

function buildTriggerToken(name: string, defaults: unknown) {
  if (defaults && typeof defaults === "object" && !Array.isArray(defaults)) {
    const token = normalizeNullableString((defaults as JsonObject).triggerToken);
    if (token) return token;
  }
  return name.trim().replace(/\s+/g, "_") || "training_project";
}

function buildProjectDefaults(input: JsonObject) {
  return {
    baseCheckpointId: normalizeNullableString(input.baseCheckpointId) ?? null,
    checkpointRelativePath: normalizeNullableString(input.checkpointRelativePath) ?? null,
    triggerToken: normalizeNullableString(input.triggerToken) ?? null,
    trainingTemplateId: normalizeNullableString(input.trainingTemplateId) ?? null,
  } satisfies JsonObject;
}

async function createUniqueProjectSlug(name: string) {
  const base = slugifyForTrainingRepository(name, "training-project");
  let candidate = base;
  let suffix = 1;
  while (await prisma.trainingProject.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

async function ensureTrainingProfile(projectId: string) {
  const existing = await prisma.trainingCharacterProfile.findUnique({
    where: {
      trainingProjectId: projectId,
    },
  });
  if (existing) return existing;
  return prisma.trainingCharacterProfile.create({
    data: {
      trainingProjectId: projectId,
    },
  });
}

function mapProjectRow(row: Prisma.TrainingProjectGetPayload<{ include: typeof trainingProjectInclude }>) {
  const defaults = row.trainingDefaultsJson;
  const triggerToken = buildTriggerToken(row.name, defaults);
  return {
    id: row.id,
    artifactRoot: formatArtifactRoot(),
    characterName: row.name,
    currentCanonicalVersionId: null,
    currentPromptCardVersionId: row.profile?.id ?? null,
    projectName: row.name,
    title: row.name,
    status: row.archivedAt ? "archived" : row.status,
    triggerToken,
    updatedAt: row.updatedAt.toISOString(),
    usagePrompt: row.profile?.loraUsagePrompt ?? "",
    detailPrompt: row.profile?.characterDetailPrompt ?? "",
    profileSummary: row.profile?.characterDetailPrompt ?? "",
    counts: {
      sourceImages: 0,
    },
  };
}

async function getProjectRow(projectId: string, client: Pick<typeof prisma, "trainingProject"> = prisma) {
  const row = await client.trainingProject.findFirst({
    where: {
      OR: [
        { id: projectId },
        { slug: projectId },
        { name: projectId },
      ],
    },
    include: trainingProjectInclude,
  });
  if (!row) {
    throw new TrainingRepositoryError("Training project not found", 404, { projectId });
  }
  return row;
}

async function getSectionRow(sectionId: string, projectId?: string | null) {
  const project = projectId ? await getProjectRow(projectId) : null;
  const section = project
    ? (await prisma.trainingSection.findMany({
      where: { trainingProjectId: project.id },
      include: sectionInclude,
    })).find((candidate) => candidate.id === sectionId || getPublicSectionId(candidate) === sectionId) ?? null
    : await prisma.trainingSection.findUnique({
      where: { id: sectionId },
      include: sectionInclude,
    }) ?? (await prisma.trainingSection.findMany({
      include: sectionInclude,
      orderBy: {
        createdAt: "desc",
      },
    }))
      .filter((candidate) => getPublicSectionId(candidate) === sectionId)
      .at(0) ?? null;
  if (!section) {
    throw new TrainingRepositoryError("Training section not found", 404, {
      projectId: project?.id ?? projectId ?? null,
      sectionId,
    });
  }
  return section;
}

function mapSectionRow(section: Prisma.TrainingSectionGetPayload<{ include: typeof sectionInclude }>) {
  const latestRun = section.runs[0] ?? null;
  return {
    id: getPublicSectionId(section),
    internalId: section.id,
    jobId: section.trainingProjectId,
    name: section.name ?? "训练小节",
    pendingCount: latestRun?.status === "queued" || latestRun?.status === "running" ? 1 : 0,
    keepCount: 0,
    status: section.enabled ? "active" : "paused",
    template: {
      description: normalizeNullableString(parseJsonObject(section.sectionDefaultsJson)[RESOLVED_SCENE_KEY])
        ?? (section.blocks
        .filter((block) => block.enabled)
        .map((block) => block.localText || block.title)
        .join("\n\n") || section.name || "训练场景说明"),
    },
    updatedAt: section.updatedAt.toISOString(),
  };
}

function mapCharacterImageRow(
  row: Prisma.TrainingCharacterImageGetPayload<{ include: { artifact: true; profile: true } }>,
) {
  const relativePath = row.artifact.filePath ?? row.artifact.storageKey;
  const kind = row.imageType === "source" ? "original" : row.imageType === "generated" ? "generated" : "auxiliary";
  return {
    id: row.id,
    artifactId: row.artifactId,
    jobId: row.profile.trainingProjectId,
    kind,
    label: row.label,
    note: row.note,
    role: row.imageType,
    relativePath,
    absolutePath: relativePath ? join(process.cwd(), relativePath) : null,
    sha256: row.artifact.sha256,
    byteSize: serializeFileSize(row.artifact.fileSize),
    mimeType: row.artifact.mimeType,
    width: row.artifact.width,
    height: row.artifact.height,
    provenance: {
      kind,
      label: row.label,
      note: row.note,
    },
    sortOrder: row.sortOrder,
  };
}

function mapCandidateImageRow(
  row: Prisma.TrainingImageResultGetPayload<{ include: typeof candidateImageInclude }>,
) {
  const relativePath = row.filePathSnapshot ?? row.artifact.filePath ?? row.artifact.storageKey;
  const taskId = row.generationTaskOutput?.trainingGenerationTaskId ?? row.sectionRun?.generationTaskId ?? null;
  const sectionId = row.sectionRun?.section ? getPublicSectionId(row.sectionRun.section) : row.sectionRun?.trainingSectionId ?? null;
  return {
    id: row.id,
    artifactId: row.artifactId,
    jobId: row.trainingProjectId,
    sectionId,
    generationRunId: taskId,
    relativePath,
    sha256: row.sha256 ?? row.artifact.sha256,
    fileSize: row.fileSize ? row.fileSize.toString() : row.artifact.fileSize?.toString() ?? null,
    width: row.width ?? row.artifact.width,
    height: row.height ?? row.artifact.height,
    reviewStatus: row.reviewStatus,
    captionDraft: row.trainingCaption,
    includedDatasetRevisionId: row.datasetItems[0]?.trainingDatasetRevisionId ?? null,
  };
}

function mapDatasetRevisionRow(
  row: Prisma.TrainingDatasetRevisionGetPayload<{ include: { manifestArtifact: true; items: true } }>,
) {
  return {
    id: row.id,
    jobId: row.trainingProjectId,
    version: row.version,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    itemCount: row.itemCount,
    captionMissingCount: row.captionMissingCount,
    selectedManifestArtifactId: row.manifestArtifactId,
    manifestName: row.manifestName,
  };
}

function mapTrainingRunRow(row: Prisma.TrainingRunGetPayload<{ include: { finalArtifact: true; logArtifact: true } }>) {
  const finalArtifactPath = row.finalArtifact?.filePath ?? row.finalArtifact?.storageKey ?? null;
  const logArtifactPath = row.logArtifact?.filePath ?? row.logArtifact?.storageKey ?? null;

  return {
    id: row.id,
    jobId: row.trainingProjectId,
    datasetRevisionId: row.trainingDatasetRevisionId,
    status: normalizeRunStatus(row.status),
    finalSafetensorsArtifactId: row.finalLoraArtifactId,
    finalSafetensorsArtifactName: finalArtifactPath ? basename(finalArtifactPath) : null,
    resolvedConfig: row.runSummaryJson,
    metadataSummary: row.progressJson,
    logArtifactId: row.trainingLogArtifactId,
    logArtifactName: logArtifactPath ? basename(logArtifactPath) : null,
    createdPresetId: row.createdPresetId,
    presetCreatedAt: row.presetCreatedAt?.toISOString() ?? null,
    currentStep: row.currentStep,
    targetSteps: row.totalSteps,
    schedulerMessage: row.schedulerMessage,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapGenerationTaskRow(
  row: Prisma.TrainingGenerationTaskGetPayload<{
    include: {
      inputs: { include: { artifact: true; snapshotArtifact: true } };
      outputs: true;
      sectionRuns: { include: { section: true } };
    };
  }>,
) {
  const sectionRun = row.sectionRuns[0] ?? null;
  const sectionId = sectionRun?.section ? getPublicSectionId(sectionRun.section) : sectionRun?.trainingSectionId ?? null;
  return {
    id: row.id,
    jobId: row.trainingProjectId,
    sectionId,
    status: normalizeRunStatus(row.status),
    provider: row.provider,
    imageModel: row.model,
    hostModel: row.model,
    visualPrompt: row.supplementalPrompt ?? sectionRun?.imagePromptText ?? null,
    hostInstruction: row.supplementalPrompt,
    inputImages: row.inputs.flatMap((input) => {
      const artifact = input.artifact ?? input.snapshotArtifact;
      if (!artifact) return [];
      return [{
        relativePath: artifact.filePath ?? artifact.storageKey,
        role: input.role ?? input.purpose ?? "reference",
      }];
    }),
    counts: {
      candidateImages: row.outputs.length,
    },
    errorSummary: row.errorMessage,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function createTrainingArtifact(input: {
  metadata?: unknown;
  mimeType?: string | null;
  projectId: string;
  relativePath: string;
  role?: string;
  sha256?: string | null;
  size?: bigint | number | null;
  width?: number | null;
  height?: number | null;
}) {
  const storageKey = input.relativePath;
  return prisma.trainingArtifact.upsert({
    where: {
      trainingProjectId_storageKey: {
        trainingProjectId: input.projectId,
        storageKey,
      },
    },
    update: {
      filePath: input.relativePath,
      fileSize: typeof input.size === "number" ? BigInt(input.size) : input.size ?? undefined,
      lifecycleStatus: "active",
      metadata: input.metadata === undefined ? undefined : normalizeJson(input.metadata),
      mimeType: input.mimeType ?? undefined,
      sha256: input.sha256 ?? undefined,
      storageRole: input.role ?? undefined,
      width: input.width ?? undefined,
      height: input.height ?? undefined,
    },
    create: {
      trainingProjectId: input.projectId,
      storageKey,
      filePath: input.relativePath,
      fileSize: typeof input.size === "number" ? BigInt(input.size) : input.size ?? null,
      lifecycleStatus: "active",
      metadata: input.metadata === undefined ? Prisma.JsonNull : normalizeJson(input.metadata),
      mimeType: input.mimeType ?? null,
      sha256: input.sha256 ?? null,
      storageRole: input.role ?? "mutable_source",
      width: input.width ?? null,
      height: input.height ?? null,
    },
  });
}

export async function createTrainingProductionProject(input: unknown) {
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const name =
    normalizeNullableString(data.characterName)
    ?? normalizeNullableString(data.projectName)
    ?? normalizeNullableString(data.title)
    ?? "新角色 LoRA 项目";
  const slug = await createUniqueProjectSlug(name);
  const defaults = buildProjectDefaults({ ...data, triggerToken: normalizeNullableString(data.triggerToken) ?? name.replace(/\s+/g, "_") });
  const templateId = normalizeNullableString(data.trainingTemplateId);
  const template = templateId
    ? await prisma.trainingTemplate.findUnique({ where: { id: templateId } })
    : null;
  if (templateId && !template) {
    throw new TrainingRepositoryError("Training template not found", 404, { templateId });
  }

  const project = await prisma.trainingProject.create({
    data: {
      name,
      slug,
      status: "active",
      imagePromptGuidance: template?.imagePromptGuidance ?? "生成干净、稳定、可训练的角色图片。",
      imagePromptFormat: template?.imagePromptFormat ?? "{{profile}}\n{{scene}}",
      captioningGuidance: template?.captioningGuidance ?? "为训练图生成清晰、简洁的 caption。",
      trainingCaptionFormat: template?.trainingCaptionFormat ?? "{{caption}}",
      trainingDefaultsJson: defaults as Prisma.InputJsonValue,
      profile: {
        create: {
          loraUsagePrompt: normalizeNullableString(data.usagePrompt) ?? "",
          characterDetailPrompt: normalizeNullableString(data.detailPrompt) ?? "",
        },
      },
    },
    include: trainingProjectInclude,
  });

  if (template) {
    const sections = await prisma.trainingTemplateSection.findMany({
      where: {
        trainingTemplateId: template.id,
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        blocks: {
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });
    for (const section of sections) {
      await prisma.trainingSection.create({
        data: {
          trainingProjectId: project.id,
          name: section.name,
          sortOrder: section.sortOrder,
          enabled: section.enabled,
          sectionDefaultsJson: section.sectionDefaultsJson ?? Prisma.JsonNull,
          blocks: {
            create: section.blocks.map((block) => ({
              sceneDescriptionPresetCategoryId: block.sceneDescriptionPresetCategoryId ?? null,
              sceneDescriptionPresetId: block.sceneDescriptionPresetId ?? null,
              sourceType: block.sourceType,
              title: block.title,
              localText: block.localText ?? null,
              sortOrder: block.sortOrder,
              enabled: block.enabled,
            })),
          },
        },
      });
    }
  }

  return mapProjectRow(project);
}

export async function replaceTrainingProjectSections(projectId: string, sections: TrainingProjectSectionInput[]) {
  const row = await getProjectRow(projectId);

  return prisma.$transaction(async (tx) => {
    await tx.trainingSection.deleteMany({
      where: {
        trainingProjectId: row.id,
      },
    });

    for (const [index, section] of sections.entries()) {
      const sectionId = `training-section-${row.id}-${index + 1}-${randomUUID()}`;
      const blocks = section.blocks?.length
        ? section.blocks
        : [{
          source: "本地",
          title: section.title ?? "训练场景说明",
          text: section.resolvedScene ?? section.title ?? "训练场景说明",
        }];
      const internalBlockIds = blocks.map((_, blockIndex) => `training-block-${sectionId}-${blockIndex + 1}-${randomUUID()}`);
      const publicBlockIds = Object.fromEntries(blocks.flatMap((block, blockIndex) => {
        const publicBlockId = normalizeNullableString(block.id);
        return publicBlockId ? [[internalBlockIds[blockIndex], publicBlockId]] : [];
      }));
      const createdSection = await tx.trainingSection.create({
        data: {
          id: sectionId,
          trainingProjectId: row.id,
          name: section.title ?? `训练小节 ${index + 1}`,
          sortOrder: section.sortOrder ?? index,
          enabled: section.enabled ?? true,
          sectionDefaultsJson: buildSectionDefaults({
            publicBlockIds,
            publicSectionId: section.id,
            resolvedScene: section.resolvedScene,
          }),
        },
      });

      await tx.trainingSceneDescriptionBlock.createMany({
        data: blocks.map((block, blockIndex) => ({
          id: internalBlockIds[blockIndex],
          trainingSectionId: createdSection.id,
          sourceType: block.source === "预制" ? "preset" : "local",
          title: block.title ?? `场景块 ${blockIndex + 1}`,
          localText: block.text ?? block.title ?? "",
          sortOrder: blockIndex,
          enabled: true,
        })),
      });
    }

    return tx.trainingSection.findMany({
      where: {
        trainingProjectId: row.id,
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      include: sectionInclude,
    });
  });
}

export async function updateTrainingProductionProject(projectId: string, input: unknown) {
  const current = await getProjectRow(projectId);
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const nextName =
    normalizeNullableString(data.title)
    ?? normalizeNullableString(data.characterName)
    ?? normalizeNullableString(data.projectName)
    ?? current.name;

  const updated = await prisma.trainingProject.update({
    where: { id: current.id },
    data: {
      name: nextName,
      profile: {
        upsert: {
          create: {
            characterDetailPrompt: normalizeNullableString(data.detailPrompt) ?? "",
            loraUsagePrompt: normalizeNullableString(data.usagePrompt) ?? "",
          },
          update: {
            characterDetailPrompt: normalizeNullableString(data.detailPrompt) ?? undefined,
            loraUsagePrompt: normalizeNullableString(data.usagePrompt) ?? undefined,
          },
        },
      },
    },
    include: trainingProjectInclude,
  });
  return {
    ...mapProjectRow(updated),
    profileSummary: normalizeNullableString(data.profileSummary) ?? mapProjectRow(updated).profileSummary,
  };
}

export async function archiveTrainingProductionProject(projectId: string) {
  const current = await getProjectRow(projectId);
  const updated = await prisma.trainingProject.update({
    where: { id: current.id },
    data: {
      archivedAt: new Date(),
      status: "archived",
    },
    include: trainingProjectInclude,
  });
  return mapProjectRow(updated);
}

export async function restoreTrainingProductionProject(projectId: string) {
  const current = await getProjectRow(projectId);
  const updated = await prisma.trainingProject.update({
    where: { id: current.id },
    data: {
      archivedAt: null,
      status: "active",
    },
    include: trainingProjectInclude,
  });
  return mapProjectRow(updated);
}

export async function deleteTrainingProductionProject(projectId: string) {
  const current = await getProjectRow(projectId);
  const [generationRunCount, trainingRunCount] = await Promise.all([
    prisma.trainingGenerationTask.count({ where: { trainingProjectId: current.id } }),
    prisma.trainingRun.count({ where: { trainingProjectId: current.id } }),
  ]);

  await prisma.trainingProject.delete({
    where: {
      id: current.id,
    },
  });

  return {
    deletedRunCount: generationRunCount + trainingRunCount,
    id: current.id,
    success: true,
  };
}

export async function getTrainingProductionProject(projectId: string) {
  const row = await getProjectRow(projectId);
  const sourceImages = await prisma.trainingCharacterImage.count({
    where: {
      profile: {
        trainingProjectId: row.id,
      },
    },
  });
  return {
    ...mapProjectRow(row),
    counts: {
      sourceImages,
    },
  };
}

export async function getTrainingProductionProjectOverview(projectId: string) {
  const row = await getProjectRow(projectId);
  const profile = row.profile ?? await ensureTrainingProfile(row.id);
  const [referenceImageCount, sectionCount, keptCount, captionMissingCount] = await Promise.all([
    prisma.trainingCharacterImage.count({ where: { profile: { trainingProjectId: row.id } } }),
    prisma.trainingSection.count({ where: { trainingProjectId: row.id } }),
    prisma.trainingImageResult.count({ where: { trainingProjectId: row.id, reviewStatus: "keep", removedAt: null } }),
    prisma.trainingImageResult.count({
      where: {
        trainingProjectId: row.id,
        reviewStatus: "keep",
        removedAt: null,
        OR: [
          { trainingCaption: null },
          { trainingCaption: "" },
        ],
      },
    }),
  ]);
  const missingItems = [
    !profile.loraUsagePrompt.trim() ? { key: "profile_usage", label: "LoRA 使用提示词", blocking: true } : null,
    !profile.characterDetailPrompt.trim() ? { key: "profile_detail", label: "角色细节", blocking: true } : null,
    referenceImageCount === 0 ? { key: "reference_images", label: "参考图", blocking: true } : null,
    sectionCount === 0 ? { key: "sections", label: "训练小节", blocking: true } : null,
    keptCount > 0 && captionMissingCount > 0 ? { key: "captions", label: "caption 缺失", blocking: true } : null,
  ].filter((item): item is { blocking: boolean; key: string; label: string } => Boolean(item));

  return {
    job: mapProjectRow(row),
    missingItems,
    personaReference: {
      currentCanonicalVersionId: null,
    },
    sourceImages: {
      count: referenceImageCount,
    },
    sections: {
      count: sectionCount,
    },
    results: {
      captionMissingCount,
      keptCount,
    },
  };
}

export async function listTrainingPromptCardVersions(projectId: string) {
  const row = await getProjectRow(projectId);
  const profile = row.profile ?? await ensureTrainingProfile(row.id);
  return [
    {
      id: profile.id,
      canonicalVersionId: null,
      triggerToken: buildTriggerToken(row.name, row.trainingDefaultsJson),
      identityTraits: {},
      outfitTraits: {},
      negativeTraits: [],
      finalPromptDraft: profile.loraUsagePrompt || buildTriggerToken(row.name, row.trainingDefaultsJson),
    },
  ];
}

export async function createTrainingPromptCardVersion(projectId: string, input: unknown) {
  const row = await getProjectRow(projectId);
  const profile = row.profile ?? await ensureTrainingProfile(row.id);
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const finalPromptDraft = normalizeNullableString(data.finalPromptDraft) ?? profile.loraUsagePrompt;
  const detailPayload = {
    identityTraits: data.identityTraits ?? {},
    negativeTraits: data.negativeTraits ?? [],
    outfitTraits: data.outfitTraits ?? {},
  };
  const updated = await prisma.trainingCharacterProfile.update({
    where: { id: profile.id },
    data: {
      characterDetailPrompt: JSON.stringify(detailPayload, null, 2),
      loraUsagePrompt: finalPromptDraft,
    },
  });
  await prisma.trainingTextRevision.create({
    data: {
      trainingProjectId: row.id,
      entityType: "profile",
      entityId: updated.id,
      fieldName: "loraUsagePrompt",
      textValue: finalPromptDraft,
      reason: normalizeNullableString(data.changeReason) ?? "profile_update",
    },
  });
  return {
    id: updated.id,
    canonicalVersionId: null,
    triggerToken: buildTriggerToken(row.name, row.trainingDefaultsJson),
    identityTraits: detailPayload.identityTraits,
    outfitTraits: detailPayload.outfitTraits,
    negativeTraits: detailPayload.negativeTraits,
    finalPromptDraft,
  };
}

export async function listTrainingReferenceImagesForProject(projectId: string) {
  const row = await getProjectRow(projectId);
  return prisma.trainingCharacterImage.findMany({
    where: {
      profile: {
        trainingProjectId: row.id,
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      artifact: true,
      profile: true,
    },
  }).then((rows) => rows.map(mapCharacterImageRow));
}

export const listTrainingReferenceImages = listTrainingReferenceImagesForProject;

export async function getTrainingReferenceImageRecord(imageId: string) {
  const row = await prisma.trainingCharacterImage.findUnique({
    where: { id: imageId },
    include: {
      artifact: true,
      profile: true,
    },
  });
  return row ? mapCharacterImageRow(row) : null;
}

export const getTrainingReferenceImageRecordFromRepository = getTrainingReferenceImageRecord;

export async function updateTrainingReferenceImageRecord(projectId: string, imageId: string, input: unknown) {
  const row = await getProjectRow(projectId);
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const current = await prisma.trainingCharacterImage.findFirst({
    where: {
      id: imageId,
      profile: {
        trainingProjectId: row.id,
      },
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  if (!current) {
    throw new TrainingRepositoryError("Training reference image not found", 404, { imageId, projectId });
  }
  const updated = await prisma.trainingCharacterImage.update({
    where: { id: imageId },
    data: {
      imageType: normalizeNullableString(data.kind) ?? normalizeNullableString(data.role) ?? current.imageType,
      label: normalizeNullableString(data.label) ?? current.label,
      note: normalizeNullableString(data.note) ?? current.note,
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : current.sortOrder,
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  return mapCharacterImageRow(updated);
}

export async function deleteTrainingReferenceImageRecord(projectId: string, imageId: string) {
  const row = await getProjectRow(projectId);
  const deleted = await prisma.trainingCharacterImage.deleteMany({
    where: {
      id: imageId,
      profile: {
        trainingProjectId: row.id,
      },
    },
  });
  if (deleted.count === 0) {
    throw new TrainingRepositoryError("Training reference image not found", 404, { imageId, projectId });
  }
  return {
    id: imageId,
    success: true,
  };
}

export async function uploadTrainingReferenceImage(projectId: string, formData: FormData) {
  const row = await getProjectRow(projectId);
  const profile = row.profile ?? await ensureTrainingProfile(row.id);
  const file = formData.get("file");
  if (!isFileLike(file)) {
    throw new TrainingRepositoryError("file is required", 400);
  }
  const role = normalizeNullableString(formData.get("role")) ?? TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE;
  const sortOrder = Number(normalizeNullableString(formData.get("sortOrder")) ?? "0");
  const safeName = normalizeUploadName(file.name);
  const relativePath = `data/images/training/${row.id}/references/${nowStorageStamp()}-${safeName}`;
  const absolutePath = join(process.cwd(), relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const artifact = await createTrainingArtifact({
    metadata: {
      originalName: file.name,
      purpose: "reference_upload",
    },
    mimeType: file.type || null,
    projectId: row.id,
    relativePath,
    role: "mutable_source",
    sha256,
    size: BigInt(buffer.byteLength),
  });
  const image = await prisma.trainingCharacterImage.create({
    data: {
      trainingCharacterProfileId: profile.id,
      artifactId: artifact.id,
      imageType: role,
      label: basename(file.name, extname(file.name)) || "参考图",
      note: role,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  return mapCharacterImageRow(image);
}

export async function registerTrainingReferenceImageFromArtifact(projectId: string, input: unknown) {
  const row = await getProjectRow(projectId);
  const profile = row.profile ?? await ensureTrainingProfile(row.id);
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const artifactId = normalizeNullableString(data.artifactId);
  const relativePath = normalizeNullableString(data.relativePath);
  const artifact = artifactId
    ? await prisma.trainingArtifact.findFirst({ where: { id: artifactId, trainingProjectId: row.id } })
    : relativePath
      ? await createTrainingArtifact({
        metadata: { purpose: "reference_register" },
        projectId: row.id,
        relativePath,
        role: "mutable_source",
        sha256: normalizeNullableString(data.sha256),
      })
      : null;
  if (!artifact) {
    throw new TrainingRepositoryError("Training artifact not found", 404, { artifactId, projectId, relativePath });
  }
  const image = await prisma.trainingCharacterImage.create({
    data: {
      trainingCharacterProfileId: profile.id,
      artifactId: artifact.id,
      imageType: normalizeNullableString(data.imageType) ?? normalizeNullableString(data.kind) ?? normalizeNullableString(data.role) ?? TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE,
      label: normalizeNullableString(data.label),
      note: normalizeNullableString(data.note),
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  return mapCharacterImageRow(image);
}

export async function findTrainingReferenceImageDuplicate(input: {
  jobId: string;
  role?: string | null;
  sha256?: string | null;
}) {
  if (!input.sha256) return null;
  const row = await prisma.trainingCharacterImage.findFirst({
    where: {
      imageType: input.role ?? undefined,
      profile: {
        trainingProjectId: input.jobId,
      },
      artifact: {
        sha256: input.sha256,
      },
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  return row ? mapCharacterImageRow(row) : null;
}

export async function createTrainingReferenceImage(input: {
  absolutePath?: string | null;
  artifactMetadata?: unknown;
  byteSize?: bigint | null;
  jobId: string;
  mimeType?: string | null;
  provenance?: unknown;
  relativePath: string;
  role?: string | null;
  sha256?: string | null;
  sortOrder?: number;
  width?: number | null;
  height?: number | null;
}) {
  const row = await getProjectRow(input.jobId);
  const profile = row.profile ?? await ensureTrainingProfile(row.id);
  const provenance = input.provenance && typeof input.provenance === "object" && !Array.isArray(input.provenance)
    ? input.provenance as JsonObject
    : {};
  const artifact = await createTrainingArtifact({
    metadata: input.artifactMetadata ?? provenance,
    mimeType: input.mimeType ?? null,
    projectId: row.id,
    relativePath: input.relativePath,
    role: "mutable_source",
    sha256: input.sha256 ?? null,
    size: input.byteSize ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
  });
  const image = await prisma.trainingCharacterImage.create({
    data: {
      trainingCharacterProfileId: profile.id,
      artifactId: artifact.id,
      imageType: input.role ?? TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE,
      label: normalizeNullableString(provenance.label),
      note: normalizeNullableString(provenance.note),
      sortOrder: input.sortOrder ?? 0,
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  return mapCharacterImageRow(image);
}

export async function getTrainingCandidateImage(imageId: string) {
  const row = await prisma.trainingImageResult.findUnique({
    where: { id: imageId },
    include: candidateImageInclude,
  });
  return row ? mapCandidateImageRow(row) : null;
}

export async function listTrainingCandidateImages(projectId: string) {
  const row = await getProjectRow(projectId);
  const rows = await prisma.trainingImageResult.findMany({
    where: {
      trainingProjectId: row.id,
      removedAt: null,
    },
    orderBy: [
      { createdAt: "desc" },
    ],
    include: candidateImageInclude,
  });
  return rows.map(mapCandidateImageRow);
}

export async function updateTrainingCandidateImageCaption(imageId: string, input: unknown) {
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const caption = normalizeNullableString(data.captionDraft) ?? normalizeNullableString(data.caption) ?? "";
  const updated = await prisma.trainingImageResult.update({
    where: { id: imageId },
    data: {
      trainingCaption: caption,
    },
    include: candidateImageInclude,
  });
  return mapCandidateImageRow(updated);
}

export async function reviewTrainingImages(input: unknown) {
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const images = Array.isArray(data.images) ? data.images : [];
  const results = [];
  for (const image of images) {
    if (!image || typeof image !== "object" || Array.isArray(image)) continue;
    const item = image as JsonObject;
    const imageId = normalizeNullableString(item.imageId);
    if (!imageId) continue;
    const updated = await prisma.trainingImageResult.update({
      where: { id: imageId },
      data: {
        reviewStatus: normalizeReviewStatus(item.reviewStatus),
      },
      include: candidateImageInclude,
    });
    results.push(mapCandidateImageRow(updated));
  }
  return {
    images: results,
  };
}

export async function registerTrainingReferenceImageAsResult(input: {
  captionDraft?: string | null;
  jobId: string;
  reviewStatus?: string;
  sourceImageId: string;
}) {
  const source = await prisma.trainingCharacterImage.findFirst({
    where: {
      id: input.sourceImageId,
      profile: {
        trainingProjectId: input.jobId,
      },
    },
    include: {
      artifact: true,
      profile: true,
    },
  });
  if (!source) {
    throw new TrainingRepositoryError("Training reference image not found", 404, input);
  }
  const result = await prisma.trainingImageResult.create({
    data: {
      trainingProjectId: source.profile.trainingProjectId,
      trainingCharacterProfileId: source.trainingCharacterProfileId,
      artifactId: source.artifactId,
      sourceType: "reference_image",
      reviewStatus: normalizeReviewStatus(input.reviewStatus),
      trainingCaption: input.captionDraft ?? source.note ?? "",
      filePathSnapshot: source.artifact.filePath ?? source.artifact.storageKey,
      width: source.artifact.width,
      height: source.artifact.height,
      mimeType: source.artifact.mimeType,
      fileSize: source.artifact.fileSize,
      sha256: source.artifact.sha256,
    },
    include: candidateImageInclude,
  });
  return mapCandidateImageRow(result);
}

export async function getTrainingProductionProjectSection(sectionId: string, projectId?: string | null) {
  return mapSectionRow(await getSectionRow(sectionId, projectId));
}

export async function listTrainingProjectSections(projectId: string) {
  const row = await getProjectRow(projectId);
  const sections = await prisma.trainingSection.findMany({
    where: {
      trainingProjectId: row.id,
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    include: sectionInclude,
  });
  return sections.map(mapSectionRow);
}

export async function enqueueTrainingProductionSectionGenerationRun(sectionId: string, input: unknown = {}) {
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const section = await getSectionRow(sectionId, normalizeNullableString(data.projectId));
  const profile = await ensureTrainingProfile(section.trainingProjectId);
  const taskType = normalizeNullableString(data.taskType) ?? "trainingset_generation";
  const generationKind = normalizeNullableString(data.generationKind) ?? "image_generation";
  const prompt = normalizeNullableString(data.userInstruction)
    ?? normalizeNullableString(data.visualPrompt)
    ?? section.blocks.map((block) => block.localText || block.title).join("\n\n")
    ?? "";
  const task = await prisma.trainingGenerationTask.create({
    data: {
      trainingProjectId: section.trainingProjectId,
      generationKind,
      taskType,
      supplementalPrompt: prompt,
      status: "queued",
      provider: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.provider,
      model: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model,
      paramsJson: normalizeJson(data.paramsJson),
      sectionRuns: {
        create: {
          trainingProjectId: section.trainingProjectId,
          trainingSectionId: section.id,
          trainingCharacterProfileId: profile.id,
          runIndex: 1,
          sceneDescriptionText: section.blocks.map((block) => block.localText || block.title).join("\n\n"),
          imagePromptText: prompt,
          provider: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.provider,
          model: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model,
          generationParamsJson: normalizeJson(data.paramsJson),
          status: "queued",
        },
      },
    },
    include: {
      inputs: { include: { artifact: true, snapshotArtifact: true } },
      outputs: true,
      sectionRuns: { include: { section: true } },
    },
  });
  return mapGenerationTaskRow(task);
}

export async function cancelTrainingProductionGenerationRun(taskId: string) {
  const task = await prisma.trainingGenerationTask.update({
    where: { id: taskId },
    data: {
      errorMessage: "生成任务已取消",
      finishedAt: new Date(),
      status: "cancelled",
      sectionRuns: {
        updateMany: {
          where: {},
          data: {
            errorMessage: "生成任务已取消",
            finishedAt: new Date(),
            status: "cancelled",
          },
        },
      },
    },
    include: {
      inputs: { include: { artifact: true, snapshotArtifact: true } },
      outputs: true,
      sectionRuns: { include: { section: true } },
    },
  });
  return mapGenerationTaskRow(task);
}

export async function getTrainingGenerationRun(taskId: string) {
  const task = await prisma.trainingGenerationTask.findUnique({
    where: { id: taskId },
    include: {
      inputs: { include: { artifact: true, snapshotArtifact: true } },
      outputs: true,
      sectionRuns: { include: { section: true } },
    },
  });
  return task && !task.hiddenAt ? mapGenerationTaskRow(task) : null;
}

export async function freezeTrainingProductionDataset(projectId: string) {
  const row = await getProjectRow(projectId);
  const keptImages = await prisma.trainingImageResult.findMany({
    where: {
      trainingProjectId: row.id,
      reviewStatus: "keep",
      removedAt: null,
    },
    include: {
      artifact: true,
      sectionRun: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  if (keptImages.length === 0) {
    throw new TrainingRepositoryError("Training dataset is not ready", 409, {
      projectId: row.id,
      reason: "no_kept_results",
    });
  }
  const latest = await prisma.trainingDatasetRevision.aggregate({
    where: {
      trainingProjectId: row.id,
    },
    _max: {
      version: true,
    },
  });
  const version = (latest._max.version ?? 0) + 1;
  const captionMissingCount = keptImages.filter((image) => !image.trainingCaption?.trim()).length;
  const manifestRelativePath = `data/images/training/${row.id}/datasets/v${version}/manifest.jsonl`;
  const manifestRows = keptImages.map((image, index) => JSON.stringify({
    caption: image.trainingCaption ?? "",
    filePath: image.filePathSnapshot ?? image.artifact.filePath ?? image.artifact.storageKey,
    index,
    imageResultId: image.id,
  }));
  const manifestBuffer = Buffer.from(`${manifestRows.join("\n")}\n`, "utf8");
  const manifestPath = join(process.cwd(), manifestRelativePath);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, manifestBuffer);
  const manifestArtifact = await createTrainingArtifact({
    metadata: { purpose: "dataset_manifest", version },
    mimeType: "application/jsonl",
    projectId: row.id,
    relativePath: manifestRelativePath,
    role: "dataset_manifest",
    sha256: createHash("sha256").update(manifestBuffer).digest("hex"),
    size: BigInt(manifestBuffer.byteLength),
  });
  const revision = await prisma.trainingDatasetRevision.create({
    data: {
      trainingProjectId: row.id,
      version,
      status: "ready",
      itemCount: keptImages.length,
      captionMissingCount,
      frozenAt: new Date(),
      manifestArtifactId: manifestArtifact.id,
      manifestName: `dataset_v${version}.jsonl`,
      items: {
        create: keptImages.map((image, index) => ({
          sourceTrainingImageResultId: image.id,
          sourceArtifactId: image.artifactId,
          snapshotArtifactId: image.artifactId,
          filePathSnapshot: image.filePathSnapshot ?? image.artifact.filePath ?? image.artifact.storageKey,
          captionSnapshot: image.trainingCaption ?? "",
          sceneDescriptionText: image.sectionRun?.sceneDescriptionText ?? null,
          supplementalPromptSnapshot: image.supplementalPrompt ?? null,
          width: image.width ?? image.artifact.width,
          height: image.height ?? image.artifact.height,
          sortOrder: index,
        })),
      },
    },
    include: {
      manifestArtifact: true,
      items: true,
    },
  });
  return {
    revision: mapDatasetRevisionRow(revision),
  };
}

export async function listTrainingDatasetRevisions(projectId: string) {
  const row = await getProjectRow(projectId);
  const revisions = await prisma.trainingDatasetRevision.findMany({
    where: {
      trainingProjectId: row.id,
    },
    orderBy: {
      version: "desc",
    },
    include: {
      manifestArtifact: true,
      items: true,
    },
  });
  return revisions.map(mapDatasetRevisionRow);
}

export async function enqueueTrainingProductionRun(revisionId: string, input: unknown = {}) {
  const revision = await prisma.trainingDatasetRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) {
    throw new TrainingRepositoryError("Training dataset revision not found", 404, { revisionId });
  }
  const data = input && typeof input === "object" ? input as JsonObject : {};
  const config = normalizeJson(data);
  const active = await prisma.trainingRun.findFirst({
    where: {
      hiddenAt: null,
      trainingProjectId: revision.trainingProjectId,
      status: {
        in: ["queued", "running"],
      },
    },
  });
  if (active) {
    throw new TrainingRepositoryError("Training project already has an active training run", 409, {
      activeRunId: active.id,
      projectId: revision.trainingProjectId,
    });
  }
  const run = await prisma.trainingRun.create({
    data: {
      trainingProjectId: revision.trainingProjectId,
      trainingDatasetRevisionId: revision.id,
      status: "queued",
      runSummaryJson: config,
      totalSteps: typeof data.targetSteps === "number" ? data.targetSteps : 2400,
      schedulerMessage: "等待训练队列处理",
      runnerType: normalizeNullableString(data.runnerType) ?? "local_wsl_sd_scripts",
    },
    include: {
      finalArtifact: true,
      logArtifact: true,
    },
  });
  return mapTrainingRunRow(run);
}

export async function cancelTrainingProductionRun(trainingRunId: string) {
  const run = await prisma.trainingRun.update({
    where: { id: trainingRunId },
    data: {
      cancelRequestedAt: new Date(),
      errorMessage: "训练任务已取消",
      finishedAt: new Date(),
      schedulerMessage: "训练任务已取消",
      status: "failed",
    },
    include: {
      finalArtifact: true,
      logArtifact: true,
    },
  });
  return mapTrainingRunRow(run);
}

export async function listTrainingRuns(projectId: string) {
  const row = await getProjectRow(projectId);
  const runs = await prisma.trainingRun.findMany({
    where: {
      hiddenAt: null,
      trainingProjectId: row.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      finalArtifact: true,
      logArtifact: true,
    },
  });
  return runs.map(mapTrainingRunRow);
}

export async function listTrainingProductionProjects(input: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 20));
  const [rows, total] = await Promise.all([
    prisma.trainingProject.findMany({
      where: {
        hiddenAt: null,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [
        { sortOrder: "asc" },
        { updatedAt: "desc" },
      ],
      include: trainingProjectInclude,
    }),
    prisma.trainingProject.count({
      where: {
        hiddenAt: null,
      },
    }),
  ]);
  return {
    jobs: rows.map(mapProjectRow),
    page,
    pageSize,
    total,
  };
}

export async function getTrainingProductionProjectRecord(projectId: string) {
  return getTrainingProductionProject(projectId);
}

export async function getTrainingProductionSectionRecord(sectionId: string) {
  return getTrainingProductionProjectSection(sectionId);
}

export async function createTrainingProjectArtifact(input: {
  absolutePath?: string | null;
  jobId: string;
  kind?: string;
  relativePath: string;
  sha256?: string | null;
  byteSize?: bigint | number | null;
  mimeType?: string | null;
  metadata?: unknown;
}) {
  const row = await getProjectRow(input.jobId);
  const artifact = await createTrainingArtifact({
    metadata: input.metadata ?? { kind: input.kind ?? "artifact" },
    mimeType: input.mimeType ?? null,
    projectId: row.id,
    relativePath: input.relativePath,
    role: input.kind ?? "artifact",
    sha256: input.sha256 ?? null,
    size: input.byteSize ?? null,
  });
  return {
    ...artifact,
    absolutePath: input.absolutePath ?? join(process.cwd(), artifact.filePath ?? artifact.storageKey),
    byteSize: artifact.fileSize ? Number(artifact.fileSize) : input.byteSize ? Number(input.byteSize) : 0,
    relativePath: artifact.filePath ?? artifact.storageKey,
  };
}

export async function writeTrainingBufferArtifact(input: {
  buffer: Buffer;
  jobId: string;
  kind?: string;
  mimeType?: string | null;
  relativePath: string;
  metadata?: unknown;
}): Promise<Awaited<ReturnType<typeof createTrainingProjectArtifact>>>;
export async function writeTrainingBufferArtifact(
  artifactRoot: string,
  relativePath: string,
  buffer: Buffer,
): Promise<{
  absolutePath: string;
  byteSize: number;
  relativePath: string;
  sha256: string;
}>;
export async function writeTrainingBufferArtifact(
  inputOrArtifactRoot: {
    buffer: Buffer;
    jobId: string;
    kind?: string;
    mimeType?: string | null;
    relativePath: string;
    metadata?: unknown;
  } | string,
  relativePathArg?: string,
  bufferArg?: Buffer,
) {
  if (typeof inputOrArtifactRoot === "string") {
    const relativePath = relativePathArg ?? "";
    const buffer = bufferArg ?? Buffer.alloc(0);
    const absolutePath = join(inputOrArtifactRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
    return {
      absolutePath,
      byteSize: buffer.byteLength,
      relativePath,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  }

  const input = inputOrArtifactRoot;
  const absolutePath = join(process.cwd(), input.relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);
  return createTrainingProjectArtifact({
    jobId: input.jobId,
    kind: input.kind,
    relativePath: input.relativePath,
    sha256: createHash("sha256").update(input.buffer).digest("hex"),
    byteSize: BigInt(input.buffer.byteLength),
    mimeType: input.mimeType ?? null,
    metadata: input.metadata,
  });
}

export function mapTrainingProductionProjectError(error: unknown) {
  if (error instanceof TrainingRepositoryError) {
    return {
      details: error.details,
      message: error.message,
      status: error.status,
    };
  }
  return {
    details: error instanceof Error ? error.message : String(error),
    message: "Unexpected training project error",
    status: 500,
  };
}

export const mapTrainingPromptCardError = mapTrainingProductionProjectError;
export const mapTrainingReferenceImageError = mapTrainingProductionProjectError;
export const mapTrainingGenerationError = mapTrainingProductionProjectError;
export const mapTrainingRunError = mapTrainingProductionProjectError;
