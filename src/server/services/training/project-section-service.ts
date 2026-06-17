import { randomUUID } from "node:crypto";
import type { LoraTrainingSection, LoraTrainingSectionBlock } from "@/features/training/types";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEFAULT_IMAGE_PROMPT = "生成干净、可训练的角色样本。";
const PUBLIC_SECTION_ID_KEY = "publicSectionId";
const PUBLIC_BLOCK_IDS_KEY = "publicBlockIds";
const RESOLVED_SCENE_KEY = "resolvedScene";

const sectionInclude = {
  blocks: {
    orderBy: [
      { sortOrder: "asc" as const },
      { createdAt: "asc" as const },
    ],
  },
} satisfies Prisma.TrainingSectionInclude;

type TrainingSectionWithBlocks = Prisma.TrainingSectionGetPayload<{ include: typeof sectionInclude }>;
type TrainingSectionClient = Pick<typeof prisma, "trainingProject" | "trainingSection" | "trainingSceneDescriptionBlock">;

const sectionBlockSchema = z.object({
  id: z.string().trim().min(1),
  source: z.enum(["预制", "本地"]),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
});

const createBlockSchema = z.object({
  source: z.enum(["预制", "本地"]).optional().default("本地"),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
}).strict();

const reorderBlocksSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1),
}).strict();

const projectSectionInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  blocks: z.array(sectionBlockSchema).min(1),
  resolvedScene: z.string().trim().min(1).max(20_000),
  imagePrompt: z.string().trim().min(1).max(20_000),
});

const sectionReorderSchema = z.object({
  orderedSectionIds: z.array(z.string().trim().min(1)).min(1),
});

export class TrainingProjectSectionServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectSectionServiceError";
    this.status = status;
    this.details = details;
  }
}

function formatSectionUpdatedAt(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseSectionInput(input: unknown) {
  const result = projectSectionInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingProjectSectionServiceError("Invalid training project section request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseCreateBlockInput(input: unknown) {
  const result = createBlockSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingProjectSectionServiceError("Invalid training section block request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getPublicSectionId(section: Pick<TrainingSectionWithBlocks, "id" | "sectionDefaultsJson">) {
  const defaults = parseJsonObject(section.sectionDefaultsJson);
  return typeof defaults[PUBLIC_SECTION_ID_KEY] === "string" && defaults[PUBLIC_SECTION_ID_KEY].trim()
    ? defaults[PUBLIC_SECTION_ID_KEY].trim()
    : section.id;
}

function getPublicBlockIds(section: Pick<TrainingSectionWithBlocks, "sectionDefaultsJson">) {
  const raw = parseJsonObject(section.sectionDefaultsJson)[PUBLIC_BLOCK_IDS_KEY];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function getPublicBlockId(blockId: string, section: Pick<TrainingSectionWithBlocks, "sectionDefaultsJson">) {
  const publicId = getPublicBlockIds(section)[blockId];
  return typeof publicId === "string" && publicId.trim() ? publicId.trim() : blockId;
}

function buildSectionDefaults(input: {
  imagePrompt?: string | null;
  publicBlockIds?: Record<string, string>;
  publicSectionId?: string | null;
  resolvedScene?: string | null;
  resultStatus?: string | null;
}) {
  const defaults: Record<string, Prisma.InputJsonValue> = {
    imagePrompt: input.imagePrompt?.trim() || DEFAULT_IMAGE_PROMPT,
    resultStatus: input.resultStatus?.trim() || "pending",
  };
  if (input.publicSectionId?.trim()) defaults[PUBLIC_SECTION_ID_KEY] = input.publicSectionId.trim();
  if (input.resolvedScene?.trim()) defaults[RESOLVED_SCENE_KEY] = input.resolvedScene.trim();
  if (input.publicBlockIds && Object.keys(input.publicBlockIds).length > 0) defaults[PUBLIC_BLOCK_IDS_KEY] = input.publicBlockIds;
  return defaults as Prisma.InputJsonObject;
}

function getSectionImagePrompt(section: TrainingSectionWithBlocks) {
  const defaults = parseJsonObject(section.sectionDefaultsJson);
  return typeof defaults.imagePrompt === "string" && defaults.imagePrompt.trim()
    ? defaults.imagePrompt.trim()
    : DEFAULT_IMAGE_PROMPT;
}

function getSectionResultStatus(section: TrainingSectionWithBlocks): LoraTrainingSection["resultStatus"] {
  const defaults = parseJsonObject(section.sectionDefaultsJson);
  return defaults.resultStatus === "kept" || defaults.resultStatus === "rejected" || defaults.resultStatus === "pending"
    ? defaults.resultStatus
    : "pending";
}

function getSectionResolvedScene(section: TrainingSectionWithBlocks, blocks: LoraTrainingSectionBlock[]) {
  const defaults = parseJsonObject(section.sectionDefaultsJson);
  return typeof defaults[RESOLVED_SCENE_KEY] === "string" && defaults[RESOLVED_SCENE_KEY].trim()
    ? defaults[RESOLVED_SCENE_KEY].trim()
    : resolveSceneFromBlocks(blocks) || section.name || "未填写场景描述";
}

function blockSourceToSourceType(source: LoraTrainingSectionBlock["source"]) {
  return source === "预制" ? "preset" : "local";
}

function sourceTypeToBlockSource(sourceType: string): LoraTrainingSectionBlock["source"] {
  return sourceType === "preset" || sourceType === "预制" ? "预制" : "本地";
}

function mapBlockRow(
  block: TrainingSectionWithBlocks["blocks"][number],
  section?: Pick<TrainingSectionWithBlocks, "sectionDefaultsJson">,
): LoraTrainingSectionBlock {
  return {
    id: section ? getPublicBlockId(block.id, section) : block.id,
    source: sourceTypeToBlockSource(block.sourceType),
    title: block.title,
    text: block.localText ?? block.title,
  };
}

function resolveSceneFromBlocks(blocks: LoraTrainingSectionBlock[]) {
  return blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

function mapSectionRow(section: TrainingSectionWithBlocks): LoraTrainingSection {
  const blocks = section.blocks.filter((block) => block.enabled).map((block) => mapBlockRow(block, section));
  const resolvedScene = getSectionResolvedScene(section, blocks);

  return {
    id: getPublicSectionId(section),
    title: section.name ?? "未命名小节",
    enabled: section.enabled,
    updatedAt: formatSectionUpdatedAt(section.updatedAt),
    blocks,
    resolvedScene,
    imagePrompt: getSectionImagePrompt(section),
    images: [],
    resultStatus: getSectionResultStatus(section),
  };
}

async function getProjectRow(projectId: string, client: TrainingSectionClient = prisma) {
  const project = await client.trainingProject.findFirst({
    where: {
      OR: [
        { id: projectId },
        { slug: projectId },
        { name: projectId },
      ],
    },
    select: {
      id: true,
    },
  });
  if (!project) {
    throw new TrainingProjectSectionServiceError("Training project not found", 404, { projectId });
  }
  return project;
}

async function listSectionRows(projectId: string, client: TrainingSectionClient = prisma) {
  const project = await getProjectRow(projectId, client);
  const sections = await client.trainingSection.findMany({
    where: {
      trainingProjectId: project.id,
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    include: sectionInclude,
  });
  return { projectId: project.id, sections };
}

async function getSectionRow(sectionId: string, projectId?: string | null, client: TrainingSectionClient = prisma) {
  const project = projectId ? await getProjectRow(projectId, client) : null;
  const section = project
    ? (await client.trainingSection.findMany({
      where: { trainingProjectId: project.id },
      include: sectionInclude,
    })).find((candidate) => candidate.id === sectionId || getPublicSectionId(candidate) === sectionId) ?? null
    : await client.trainingSection.findUnique({
      where: {
        id: sectionId,
      },
      include: sectionInclude,
    }) ?? (await client.trainingSection.findMany({
      include: sectionInclude,
      orderBy: {
        createdAt: "desc",
      },
    }))
      .filter((candidate) => getPublicSectionId(candidate) === sectionId)
      .at(0) ?? null;

  if (!section) {
    throw new TrainingProjectSectionServiceError("Training project section not found", 404, {
      projectId: project?.id ?? projectId ?? null,
      sectionId,
    });
  }

  return section;
}

function nextProjectSectionCopyNumber(sections: LoraTrainingSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function nextProjectSectionDraftNumber(projectId: string, sections: LoraTrainingSection[]) {
  const draftPrefix = `${projectId}-new-section-`;
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function createBlockId(sectionId: string) {
  return `${sectionId}-block-${randomUUID()}`;
}

async function replaceSectionBlocks(
  client: TrainingSectionClient,
  sectionId: string,
  blocks: LoraTrainingSectionBlock[],
) {
  const current = await client.trainingSection.findUnique({
    where: { id: sectionId },
    include: sectionInclude,
  });
  const existingAliases = current ? getPublicBlockIds(current) : {};
  const reverseAliases = new Map(
    Object.entries(existingAliases).flatMap(([internalId, publicId]) => (
      typeof publicId === "string" ? [[publicId, internalId]] : []
    )),
  );
  const nextBlocks = blocks.map((block) => {
    const existingInternalId = current?.blocks.some((candidate) => candidate.id === block.id)
      ? block.id
      : reverseAliases.get(block.id);
    const internalId = existingInternalId ?? createBlockId(sectionId);
    return {
      ...block,
      internalId,
      publicId: block.id === internalId ? null : block.id,
    };
  });
  const publicBlockIds = Object.fromEntries(nextBlocks.flatMap((block) => (
    block.publicId ? [[block.internalId, block.publicId]] : []
  )));

  await client.trainingSceneDescriptionBlock.deleteMany({
    where: {
      trainingSectionId: sectionId,
    },
  });

  await client.trainingSection.update({
    where: { id: sectionId },
    data: {
      sectionDefaultsJson: buildSectionDefaults({
        imagePrompt: current ? getSectionImagePrompt(current) : DEFAULT_IMAGE_PROMPT,
        publicBlockIds,
        publicSectionId: current ? getPublicSectionId(current) : null,
        resolvedScene: current ? getSectionResolvedScene(current, blocks) : resolveSceneFromBlocks(blocks),
        resultStatus: current ? getSectionResultStatus(current) : "pending",
      }),
    },
  });

  if (nextBlocks.length === 0) return;

  await client.trainingSceneDescriptionBlock.createMany({
    data: nextBlocks.map((block, index) => ({
      id: block.internalId,
      trainingSectionId: sectionId,
      sourceType: blockSourceToSourceType(block.source),
      title: block.title,
      localText: block.text,
      sortOrder: index,
      enabled: true,
    })),
  });
}

export async function listTrainingProjectSections(projectId: string) {
  const { sections } = await listSectionRows(projectId);
  return sections.map(mapSectionRow);
}

export async function getTrainingProjectSection(projectId: string, sectionId: string) {
  return mapSectionRow(await getSectionRow(sectionId, projectId));
}

export async function getTrainingSection(sectionId: string, projectId?: string | null) {
  return mapSectionRow(await getSectionRow(sectionId, projectId));
}

export async function getTrainingSectionProjectContext(sectionId: string, projectId?: string | null) {
  const section = await getSectionRow(sectionId, projectId);
  return {
    projectId: section.trainingProjectId,
    section: mapSectionRow(section),
  };
}

export async function getTrainingSectionSceneDescription(sectionId: string, projectId?: string | null) {
  const section = await getSectionRow(sectionId, projectId);
  const mapped = mapSectionRow(section);
  return {
    projectId: section.trainingProjectId,
    sectionId: mapped.id,
    text: mapped.resolvedScene,
    blocks: mapped.blocks,
  };
}

export async function getTrainingBlockProjectContext(blockId: string, projectId?: string | null) {
  const candidateSections = projectId
    ? (await listSectionRows(projectId)).sections
    : await prisma.trainingSection.findMany({
      include: sectionInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

  for (const sectionRow of candidateSections) {
    const mappedSection = mapSectionRow(sectionRow);
    const blockIndex = mappedSection.blocks.findIndex((block) => block.id === blockId);
    if (blockIndex === -1) continue;

    return {
      block: mappedSection.blocks[blockIndex],
      projectId: sectionRow.trainingProjectId,
      section: mappedSection,
    };
  }

  throw new TrainingProjectSectionServiceError("Training section block not found", 404, {
    blockId,
    projectId: projectId ?? null,
  });
}

export async function setTrainingProjectSectionCollection(projectId: string, sections: LoraTrainingSection[]) {
  if (!projectId.trim()) {
    throw new TrainingProjectSectionServiceError("projectId is required", 400);
  }

  return prisma.$transaction(async (tx) => {
    const project = await getProjectRow(projectId, tx);
    await tx.trainingSection.deleteMany({
      where: {
        trainingProjectId: project.id,
      },
    });

    for (const [index, section] of sections.entries()) {
      await tx.trainingSection.create({
        data: {
          id: section.id,
          trainingProjectId: project.id,
          name: section.title,
          sortOrder: index,
          enabled: section.enabled,
          sectionDefaultsJson: buildSectionDefaults({
            imagePrompt: section.imagePrompt,
            resolvedScene: section.resolvedScene,
            resultStatus: section.resultStatus,
          }),
          blocks: {
            create: section.blocks.map((block, blockIndex) => ({
              id: block.id,
              sourceType: blockSourceToSourceType(block.source),
              title: block.title,
              localText: block.text,
              sortOrder: blockIndex,
              enabled: true,
            })),
          },
        },
        include: sectionInclude,
      });
    }

    const nextSections = await tx.trainingSection.findMany({
      where: {
        trainingProjectId: project.id,
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      include: sectionInclude,
    });
    return nextSections.map(mapSectionRow);
  });
}

export async function upsertTrainingProjectSection(
  projectId: string,
  sectionId: string,
  input: unknown,
) {
  const parsed = parseSectionInput(input);

  return prisma.$transaction(async (tx) => {
    const project = await getProjectRow(projectId, tx);
    const current = await getSectionRow(sectionId, project.id, tx);

    await tx.trainingSection.update({
      where: {
        id: current.id,
      },
      data: {
        name: parsed.title,
        enabled: parsed.enabled,
        sectionDefaultsJson: buildSectionDefaults({
          imagePrompt: parsed.imagePrompt,
          publicBlockIds: Object.fromEntries(Object.entries(getPublicBlockIds(current)).flatMap(([internalId, publicId]) => (
            typeof publicId === "string" ? [[internalId, publicId]] : []
          ))),
          publicSectionId: getPublicSectionId(current),
          resolvedScene: parsed.resolvedScene,
          resultStatus: getSectionResultStatus(current),
        }),
      },
    });
    await replaceSectionBlocks(tx, current.id, parsed.blocks);

    const updated = await tx.trainingSection.findUniqueOrThrow({
      where: {
        id: current.id,
      },
      include: sectionInclude,
    });
    return mapSectionRow(updated);
  });
}

export async function createTrainingProjectSection(projectId: string) {
  return prisma.$transaction(async (tx) => {
    const { projectId: canonicalProjectId, sections: sectionRows } = await listSectionRows(projectId, tx);
    const sections = sectionRows.map(mapSectionRow);
    const source = sections[0];
    const draftNumber = nextProjectSectionDraftNumber(canonicalProjectId, sections);
    const draftId = `${canonicalProjectId}-new-section-${draftNumber}`;
    const draftIndex = sections.length + 1;
    const draftBlocks = source?.blocks.length
      ? source.blocks.map((block, index) => ({
        ...block,
        id: `${draftId}-block-${index + 1}`,
      }))
      : [
        { id: `${draftId}-block-1`, source: "本地" as const, title: "本地场景描述", text: "补充这个小节的训练场景描述。" },
      ];

    const draft = await tx.trainingSection.create({
      data: {
        id: draftId,
        trainingProjectId: canonicalProjectId,
        name: `新小节 ${draftIndex}`,
        sortOrder: sections.length,
        enabled: source?.enabled ?? true,
        sectionDefaultsJson: buildSectionDefaults({
          imagePrompt: source?.imagePrompt ?? DEFAULT_IMAGE_PROMPT,
          resolvedScene: source?.resolvedScene ?? "补充这个小节的训练场景描述。",
          resultStatus: "pending",
        }),
        blocks: {
          create: draftBlocks.map((block, index) => ({
            id: block.id,
            sourceType: blockSourceToSourceType(block.source),
            title: block.title,
            localText: block.text,
            sortOrder: index,
            enabled: true,
          })),
        },
      },
      include: sectionInclude,
    });

    return mapSectionRow(draft);
  });
}

export async function copyTrainingProjectSection(projectId: string, sectionId: string) {
  return prisma.$transaction(async (tx) => {
    const { projectId: canonicalProjectId, sections: sectionRows } = await listSectionRows(projectId, tx);
    const sections = sectionRows.map(mapSectionRow);
    const sourceIndex = sections.findIndex((section) => section.id === sectionId);
    if (sourceIndex === -1) {
      throw new TrainingProjectSectionServiceError("Training project section not found", 404, { projectId: canonicalProjectId, sectionId });
    }

    const source = sections[sourceIndex];
    const copyNumber = nextProjectSectionCopyNumber(sections, sectionId);
    const copyId = `${canonicalProjectId}-${sectionId}-copy-${copyNumber}-${randomUUID()}`;
    const copied = await tx.trainingSection.create({
      data: {
        id: copyId,
        trainingProjectId: canonicalProjectId,
        name: `${source.title} (副本)`,
        sortOrder: sourceIndex + 1,
        enabled: source.enabled,
        sectionDefaultsJson: buildSectionDefaults({
          imagePrompt: source.imagePrompt,
          resolvedScene: source.resolvedScene,
          resultStatus: source.resultStatus,
        }),
        blocks: {
          create: source.blocks.map((block, index) => ({
            id: `${copyId}-block-${index + 1}`,
            sourceType: blockSourceToSourceType(block.source),
            title: block.title,
            localText: block.text,
            sortOrder: index,
            enabled: true,
          })),
        },
      },
      include: sectionInclude,
    });

    await Promise.all(sectionRows.slice(sourceIndex + 1).map((section) => (
      tx.trainingSection.update({
        where: {
          id: section.id,
        },
        data: {
          sortOrder: section.sortOrder + 1,
        },
      })
    )));

    return mapSectionRow(copied);
  });
}

export async function deleteTrainingProjectSection(projectId: string, sectionId: string) {
  return prisma.$transaction(async (tx) => {
    const project = await getProjectRow(projectId, tx);
    const deleted = await tx.trainingSection.deleteMany({
      where: {
        id: sectionId,
        trainingProjectId: project.id,
      },
    });
    if (deleted.count === 0) {
      throw new TrainingProjectSectionServiceError("Training project section not found", 404, { projectId: project.id, sectionId });
    }

    const remaining = await tx.trainingSection.findMany({
      where: {
        trainingProjectId: project.id,
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
      },
    });
    await Promise.all(remaining.map((section, index) => (
      tx.trainingSection.update({
        where: {
          id: section.id,
        },
        data: {
          sortOrder: index,
        },
      })
    )));

    return { success: true };
  });
}

export async function reorderTrainingProjectSections(projectId: string, input: unknown) {
  const result = sectionReorderSchema.safeParse(input);
  if (!result.success) {
    throw new TrainingProjectSectionServiceError("Invalid training project section reorder request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return prisma.$transaction(async (tx) => {
    const { projectId: canonicalProjectId, sections: sectionRows } = await listSectionRows(projectId, tx);
    const sectionMap = new Map<string, TrainingSectionWithBlocks>();
    for (const section of sectionRows) {
      sectionMap.set(section.id, section);
      sectionMap.set(getPublicSectionId(section), section);
    }
    const orderedSections = result.data.orderedSectionIds
      .map((id) => sectionMap.get(id))
      .filter((section): section is TrainingSectionWithBlocks => Boolean(section));

    if (orderedSections.length !== sectionRows.length) {
      throw new TrainingProjectSectionServiceError("Training project section reorder is incomplete", 400, {
        expected: sectionRows.length,
        received: orderedSections.length,
        projectId: canonicalProjectId,
      });
    }

    await Promise.all(orderedSections.map((section, index) => (
      tx.trainingSection.update({
        where: {
          id: section.id,
        },
        data: {
          sortOrder: index,
        },
      })
    )));

    return orderedSections.map(mapSectionRow);
  });
}

export async function createTrainingSectionBlock(sectionId: string, input: unknown, options: { projectId?: string | null } = {}) {
  const parsed = parseCreateBlockInput(input);

  return prisma.$transaction(async (tx) => {
    const section = await getSectionRow(sectionId, options.projectId, tx);
    const block = await tx.trainingSceneDescriptionBlock.create({
      data: {
        id: createBlockId(section.id),
        trainingSectionId: section.id,
        sourceType: blockSourceToSourceType(parsed.source),
        title: parsed.title,
        localText: parsed.text,
        sortOrder: section.blocks.length,
        enabled: true,
      },
    });
    return mapBlockRow(block);
  });
}

export async function reorderTrainingSectionBlocks(sectionId: string, input: unknown, options: { projectId?: string | null } = {}) {
  const parsed = reorderBlocksSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingProjectSectionServiceError("Invalid training section block reorder request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return prisma.$transaction(async (tx) => {
    const section = await getSectionRow(sectionId, options.projectId, tx);
    const enabledBlocks = section.blocks.filter((block) => block.enabled);
    const blockMap = new Map(enabledBlocks.flatMap((block) => [
      [block.id, block] as const,
      [getPublicBlockId(block.id, section), block] as const,
    ]));
    const reorderedBlocks = parsed.data.ids
      .map((id) => blockMap.get(id))
      .filter((block): block is TrainingSectionWithBlocks["blocks"][number] => Boolean(block));

    if (reorderedBlocks.length !== enabledBlocks.length) {
      throw new TrainingProjectSectionServiceError("Training section block reorder is incomplete", 400, {
        expected: enabledBlocks.length,
        received: reorderedBlocks.length,
      });
    }

    await Promise.all(reorderedBlocks.map((block, index) => (
      tx.trainingSceneDescriptionBlock.update({
        where: {
          id: block.id,
        },
        data: {
          sortOrder: index,
        },
      })
    )));

    return reorderedBlocks.map((block) => mapBlockRow(block, section));
  });
}

export function mapTrainingProjectSectionError(error: unknown) {
  if (error instanceof TrainingProjectSectionServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project section error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
