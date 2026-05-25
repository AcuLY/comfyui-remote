import {
  listPromptBlocks,
  createPromptBlock,
  updatePromptBlock,
  deletePromptBlock,
  reorderPromptBlocks,
  PromptBlockCreateInput,
  PromptBlockUpdateInput,
} from "@/server/repositories/prompt-block-repository";
import { audit } from "@/server/services/audit-service";
import { ActorType } from "@/lib/db-enums";
import { prisma } from "@/lib/prisma";
import { detachSectionLorasFromPresetBinding } from "@/server/services/preset-binding-service";

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
  return listPromptBlocks(sectionId);
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
  const block = await prisma.promptBlock.findFirst({
    where: {
      id: blockId,
      projectSectionId: sectionId,
      projectSection: { projectId },
    },
    select: { id: true },
  });
  if (!block) {
    throw new PromptBlockServiceError("Prompt block not found in section", 404);
  }
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

  const result = await createPromptBlock(sectionId, input);
  audit("PromptBlock", result.id, "create", { sectionId, type: input.type }, actorType);
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

  if (
    input.type !== undefined ||
    input.sourceId !== undefined ||
    input.variantId !== undefined ||
    input.categoryId !== undefined ||
    input.bindingId !== undefined ||
    input.groupBindingId !== undefined ||
    shouldAutoDetachContent
  ) {
    const current = await prisma.promptBlock.findUnique({
      where: { id: blockId },
      select: {
        projectSectionId: true,
        type: true,
        sourceId: true,
        variantId: true,
        categoryId: true,
        bindingId: true,
        groupBindingId: true,
      },
    });
    if (!current) throw new Error("PROMPT_BLOCK_NOT_FOUND");
    const shouldDetachFromPreset =
      shouldAutoDetachContent &&
      (current.type === "preset" || Boolean(current.sourceId || current.bindingId));
    if (shouldDetachFromPreset) {
      input.type = "custom";
      input.sourceId = null;
      input.variantId = null;
      input.categoryId = null;
      input.bindingId = null;
      input.groupBindingId = null;
    }
    validatePresetIdentity({
      type: input.type ?? current.type,
      sourceId: input.sourceId !== undefined ? input.sourceId : current.sourceId,
      variantId: input.variantId !== undefined ? input.variantId : current.variantId,
      categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
      bindingId: input.bindingId !== undefined ? input.bindingId : current.bindingId,
      groupBindingId: input.groupBindingId !== undefined ? input.groupBindingId : current.groupBindingId,
    });
    if (shouldDetachFromPreset && current.bindingId) {
      await detachSectionLorasFromPresetBinding(current.projectSectionId, current.bindingId);
    }
  }

  const result = await updatePromptBlock(blockId, input);
  audit("PromptBlock", blockId, "update", Object.fromEntries(Object.entries(input)), actorType);
  return result;
}

export async function removePromptBlock(
  blockId: string,
  actorType: ActorType = ActorType.user,
) {
  await deletePromptBlock(blockId);
  audit("PromptBlock", blockId, "delete", {}, actorType);
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
  const result = await reorderPromptBlocks(sectionId, blockIds);
  audit("PromptBlock", sectionId, "reorder", { blockIds }, actorType);
  return result;
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
