import { type PromptBlockType } from "@/generated/prisma";
import { audit } from "@/server/services/audit-service";
import { ActorType } from "@/lib/db-enums";
import { prisma } from "@/lib/prisma";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import { detachSectionLorasFromPresetBinding } from "@/server/services/preset-binding-service";

export type PromptBlockRecord = {
  id: string;
  type: PromptBlockType;
  sourceId: string | null;
  variantId: string | null;
  categoryId: string | null;
  bindingId: string | null;
  groupBindingId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export type PromptBlockCreateInput = {
  type: PromptBlockType;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  label: string;
  positive: string;
  negative?: string | null;
  sortOrder?: number;
};

export type PromptBlockUpdateInput = {
  type?: PromptBlockType;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  label?: string;
  positive?: string;
  negative?: string | null;
  sortOrder?: number;
};

class PromptBlockServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PromptBlockServiceError";
  }
}

function ensurePositive(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PromptBlockServiceError(`${fieldName} must be a non-empty string`, 400);
  }
  return value;
}

function ensureNullableString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new PromptBlockServiceError(`${fieldName} must be a string or null`, 400);
  }
  return value.trim() || null;
}

function optionalNullableString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) return undefined;
  return ensureNullableString(value, fieldName);
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new PromptBlockServiceError(`${fieldName} must be a string`, 400);
  }
  return value;
}

function ensureValidBlockType(value: unknown): string {
  const validTypes = ["preset", "custom"];
  if (typeof value !== "string" || !validTypes.includes(value)) {
    throw new PromptBlockServiceError(
      `type must be one of: ${validTypes.join(", ")}`,
      400,
    );
  }
  return value;
}

function optionalBlockType(value: unknown): PromptBlockCreateInput["type"] | undefined {
  if (value === undefined) return undefined;
  return ensureValidBlockType(value) as PromptBlockCreateInput["type"];
}

function ensurePositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new PromptBlockServiceError(`${fieldName} must be a non-negative integer`, 400);
  }
  return value;
}

export async function getPromptBlocks(sectionId: string) {
  const rows = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: sectionId },
    include: { sectionBinding: { select: { bindingKey: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return Promise.all(rows.map(resolveNormalizedPromptBlockRecord));
}

export async function assertSectionBelongsToProject(projectId: string, sectionId: string) {
  const section = await prisma.projectSection.findFirst({
    where: { id: sectionId, projectId },
    select: { id: true },
  });
  if (!section) {
    throw new PromptBlockServiceError("Section not found in project", 404);
  }
}

export async function assertPromptBlockBelongsToSection(
  projectId: string,
  sectionId: string,
  blockId: string,
) {
  const normalizedBlock = await prisma.sectionPromptBlock.findFirst({
    where: {
      id: blockId,
      projectSectionId: sectionId,
      projectSection: { projectId },
    },
    select: { id: true },
  });
  if (normalizedBlock) return;

  throw new PromptBlockServiceError("Prompt block not found in section", 404);
}

type NormalizedPromptBlockRow = {
  id: string;
  projectSectionId: string;
  sectionBindingId: string | null;
  type: string;
  customLabel: string | null;
  customPositive: string | null;
  customNegative: string | null;
  sortOrder: number;
  sectionBinding?: { bindingKey: string } | null;
};

async function findNormalizedPromptBlock(blockId: string) {
  return prisma.sectionPromptBlock.findUnique({
    where: { id: blockId },
    include: { sectionBinding: { select: { id: true, bindingKey: true } } },
  });
}

async function resolveNormalizedPromptBlockRecord(
  row: NormalizedPromptBlockRow,
): Promise<PromptBlockRecord> {
  const resolvedConfig = await resolveSectionConfig(row.projectSectionId);
  const resolvedBlock = row.sectionBinding?.bindingKey
    ? resolvedConfig?.promptBlocks.find((block) => block.bindingId === row.sectionBinding?.bindingKey)
    : resolvedConfig?.promptBlocks.find((block) =>
        block.sortOrder === row.sortOrder &&
        block.type === row.type &&
        block.positive === (row.customPositive ?? ""),
      );

  return {
    id: row.id,
    type: (resolvedBlock?.type ?? row.type) as PromptBlockRecord["type"],
    sourceId: resolvedBlock?.sourceId ?? null,
    variantId: resolvedBlock?.variantId ?? null,
    categoryId: resolvedBlock?.categoryId ?? null,
    bindingId: resolvedBlock?.bindingId ?? null,
    groupBindingId: resolvedBlock?.groupBindingId ?? null,
    label: resolvedBlock?.label ?? row.customLabel ?? "Custom",
    positive: resolvedBlock?.positive ?? row.customPositive ?? "",
    negative: resolvedBlock?.negative ?? row.customNegative ?? null,
    sortOrder: row.sortOrder,
  };
}

async function createNormalizedPromptBlock(
  sectionId: string,
  input: PromptBlockCreateInput,
): Promise<PromptBlockRecord> {
  const row = await prisma.$transaction(async (tx) => {
    const maxResult = await tx.sectionPromptBlock.aggregate({
      where: { projectSectionId: sectionId },
      _max: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (maxResult._max.sortOrder ?? -1) + 1;

    if (input.type === "preset") {
      if (!input.sourceId || !input.categoryId || !input.bindingId) {
        throw new PromptBlockServiceError("Preset blocks require complete identity fields", 400);
      }
      const existingBinding = await tx.sectionPresetBinding.findUnique({
        where: {
          projectSectionId_bindingKey: {
            projectSectionId: sectionId,
            bindingKey: input.bindingId,
          },
        },
        select: { id: true },
      });
      const binding = existingBinding ?? await tx.sectionPresetBinding.create({
        data: {
          projectSectionId: sectionId,
          bindingKey: input.bindingId,
          categoryId: input.categoryId,
          presetId: input.sourceId,
          variantId: input.variantId ?? null,
          groupBindingKey: input.groupBindingId ?? null,
          sortOrder,
        },
        select: { id: true },
      });

      return tx.sectionPromptBlock.create({
        data: {
          projectSectionId: sectionId,
          sectionBindingId: binding.id,
          type: "preset",
          sortOrder,
        },
        include: { sectionBinding: { select: { bindingKey: true } } },
      });
    }

    return tx.sectionPromptBlock.create({
      data: {
        projectSectionId: sectionId,
        type: "custom",
        customLabel: input.label,
        customPositive: input.positive,
        customNegative: input.negative ?? null,
        sortOrder,
      },
      include: { sectionBinding: { select: { bindingKey: true } } },
    });
  });

  return resolveNormalizedPromptBlockRecord(row);
}

function validatePresetIdentity(input: {
  type?: PromptBlockCreateInput["type"];
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
}) {
  const identityFields = ["sourceId", "variantId", "categoryId", "bindingId", "groupBindingId"] as const;
  const hasIdentity = identityFields.some((field) => Boolean(input[field]));

  if (input.type === "custom" && hasIdentity) {
    throw new PromptBlockServiceError("Preset identity fields require type=preset", 400, { identityFields });
  }

  if (input.type !== "preset") return;

  const missingFields = (["sourceId", "variantId", "categoryId", "bindingId"] as const)
    .filter((field) => !input[field]);
  if (missingFields.length > 0) {
    throw new PromptBlockServiceError("Preset blocks require complete identity fields", 400, { missingFields });
  }
}

export async function addPromptBlock(
  sectionId: string,
  body: unknown,
  actorType: ActorType = ActorType.user,
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PromptBlockServiceError("Request body must be an object", 400);
  }

  const parsed = body as Record<string, unknown>;

  const input: PromptBlockCreateInput = {
    type: ensureValidBlockType(parsed.type) as PromptBlockCreateInput["type"],
    label: ensureString(parsed.label, "label"),
    positive: ensurePositive(parsed.positive, "positive"),
    negative: ensureNullableString(parsed.negative, "negative"),
    sourceId: ensureNullableString(parsed.sourceId, "sourceId"),
    variantId: ensureNullableString(parsed.variantId, "variantId"),
    categoryId: ensureNullableString(parsed.categoryId, "categoryId"),
    bindingId: ensureNullableString(parsed.bindingId, "bindingId"),
    groupBindingId: ensureNullableString(parsed.groupBindingId, "groupBindingId"),
    sortOrder: ensurePositiveInteger(parsed.sortOrder, "sortOrder"),
  };
  validatePresetIdentity(input);

  const result = await createNormalizedPromptBlock(sectionId, input);
  audit("SectionPromptBlock", result.id, "create", { sectionId, type: input.type }, actorType);
  return result;
}

export async function editPromptBlock(
  blockId: string,
  body: unknown,
  actorType: ActorType = ActorType.user,
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PromptBlockServiceError("Request body must be an object", 400);
  }

  const parsed = body as Record<string, unknown>;
  const supportedFields = [
    "type",
    "sourceId",
    "variantId",
    "categoryId",
    "bindingId",
    "groupBindingId",
    "label",
    "positive",
    "negative",
    "sortOrder",
  ];
  const unsupportedFields = Object.keys(parsed).filter((f) => !supportedFields.includes(f));

  if (unsupportedFields.length > 0) {
    throw new PromptBlockServiceError("Unsupported fields", 400, { unsupportedFields, supportedFields });
  }

  const hasAtLeastOneField = Object.values(parsed).some((v) => v !== undefined);
  if (!hasAtLeastOneField) {
    throw new PromptBlockServiceError("At least one field must be provided", 400);
  }

  const input: PromptBlockUpdateInput = {};
  if (parsed.type !== undefined) input.type = optionalBlockType(parsed.type);
  if (parsed.sourceId !== undefined) input.sourceId = optionalNullableString(parsed.sourceId, "sourceId");
  if (parsed.variantId !== undefined) input.variantId = optionalNullableString(parsed.variantId, "variantId");
  if (parsed.categoryId !== undefined) input.categoryId = optionalNullableString(parsed.categoryId, "categoryId");
  if (parsed.bindingId !== undefined) input.bindingId = optionalNullableString(parsed.bindingId, "bindingId");
  if (parsed.groupBindingId !== undefined) input.groupBindingId = optionalNullableString(parsed.groupBindingId, "groupBindingId");
  if (parsed.label !== undefined) input.label = ensureString(parsed.label, "label");
  if (parsed.positive !== undefined) input.positive = ensurePositive(parsed.positive, "positive");
  if (parsed.negative !== undefined) input.negative = ensureNullableString(parsed.negative, "negative");
  if (parsed.sortOrder !== undefined) input.sortOrder = ensurePositiveInteger(parsed.sortOrder, "sortOrder");

  const hasContentWrite =
    input.label !== undefined ||
    input.positive !== undefined ||
    input.negative !== undefined;
  const shouldAutoDetachContent = hasContentWrite && actorType !== ActorType.agent;

  const normalizedBefore = await findNormalizedPromptBlock(blockId);
  if (normalizedBefore) {
    const before = await resolveNormalizedPromptBlockRecord(normalizedBefore);
    const shouldDetachFromPreset = shouldAutoDetachContent && Boolean(normalizedBefore.sectionBinding);
    let updatedRow: NormalizedPromptBlockRow;

    if (shouldDetachFromPreset && normalizedBefore.sectionBinding) {
      await detachSectionLorasFromPresetBinding(
        normalizedBefore.projectSectionId,
        normalizedBefore.sectionBinding.bindingKey,
      );
      updatedRow = await prisma.$transaction(async (tx) => {
        const row = await tx.sectionPromptBlock.update({
          where: { id: normalizedBefore.id },
          data: {
            sectionBindingId: null,
            type: "custom",
            customLabel: input.label ?? before.label,
            customPositive: input.positive ?? before.positive,
            customNegative: input.negative !== undefined ? input.negative : before.negative,
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          },
          include: { sectionBinding: { select: { bindingKey: true } } },
        });
        await tx.sectionPresetBinding.delete({ where: { id: normalizedBefore.sectionBinding!.id } });
        return row;
      });
    } else {
      updatedRow = await prisma.sectionPromptBlock.update({
        where: { id: normalizedBefore.id },
        data: {
          ...(input.label !== undefined ? { customLabel: input.label } : {}),
          ...(input.positive !== undefined ? { customPositive: input.positive } : {}),
          ...(input.negative !== undefined ? { customNegative: input.negative } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
        include: { sectionBinding: { select: { bindingKey: true } } },
      });
    }

    const result = await resolveNormalizedPromptBlockRecord(updatedRow);
    audit("SectionPromptBlock", blockId, "update", Object.fromEntries(Object.entries(input)), actorType);
    return result;
  }

  throw new Error("PROMPT_BLOCK_NOT_FOUND");
}

export async function removePromptBlock(
  blockId: string,
  actorType: ActorType = ActorType.user,
) {
  const normalized = await findNormalizedPromptBlock(blockId);
  if (normalized) {
    await prisma.$transaction(async (tx) => {
      if (normalized.sectionBinding) {
        await tx.sectionManualLoraEntry.deleteMany({
          where: { projectSectionId: normalized.projectSectionId, sectionBindingId: normalized.sectionBinding.id },
        });
        await tx.sectionPromptBlock.delete({ where: { id: blockId } });
        await tx.sectionPresetBinding.delete({ where: { id: normalized.sectionBinding.id } });
      } else {
        await tx.sectionPromptBlock.delete({ where: { id: blockId } });
      }
    });
    audit("SectionPromptBlock", blockId, "delete", {}, actorType);
    return;
  }

  throw new Error("PROMPT_BLOCK_NOT_FOUND");
}

export async function setPromptBlockOrder(
  sectionId: string,
  body: unknown,
  actorType: ActorType = ActorType.user,
) {
  if (!Array.isArray(body) || body.length === 0) {
    throw new PromptBlockServiceError("Request body must be a non-empty array of block IDs", 400);
  }

  for (const entry of body) {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new PromptBlockServiceError("Each entry must be a non-empty block ID string", 400);
    }
  }

  const blockIds = body.map((id: unknown) => (id as string).trim());
  const normalizedBlocks = await prisma.sectionPromptBlock.findMany({
    where: { id: { in: blockIds }, projectSectionId: sectionId },
    select: { id: true },
  });
  if (normalizedBlocks.length > 0) {
    const existingIds = new Set(normalizedBlocks.map((block) => block.id));
    for (const blockId of blockIds) {
      if (!existingIds.has(blockId)) {
        throw new Error("PROMPT_BLOCK_NOT_FOUND");
      }
    }
    const rows = await prisma.$transaction(
      blockIds.map((blockId, index) =>
        prisma.sectionPromptBlock.update({
          where: { id: blockId },
          data: { sortOrder: index },
          include: { sectionBinding: { select: { bindingKey: true } } },
        }),
      ),
    );
    const result = await Promise.all(rows.map(resolveNormalizedPromptBlockRecord));
    audit("SectionPromptBlock", sectionId, "reorder", { blockIds }, actorType);
    return result;
  }

  throw new Error("PROMPT_BLOCK_NOT_FOUND");
}

export function mapPromptBlockError(error: unknown) {
  if (error instanceof PromptBlockServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (!(error instanceof Error)) {
    return {
      message: "Unexpected prompt block error",
      status: 500,
      details: String(error),
    };
  }

  switch (error.message) {
    case "PROMPT_BLOCK_NOT_FOUND":
      return { message: "Prompt block not found", status: 404 };
    default:
      return {
        message: "Unexpected prompt block error",
        status: 500,
        details: error.message,
      };
  }
}
