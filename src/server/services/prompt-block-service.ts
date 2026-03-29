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

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new PromptBlockServiceError(`${fieldName} must be a string`, 400);
  }
  return value;
}

function ensureValidBlockType(value: unknown): string {
  const validTypes = ["character", "scene", "style", "position", "custom"];
  if (typeof value !== "string" || !validTypes.includes(value)) {
    throw new PromptBlockServiceError(
      `type must be one of: ${validTypes.join(", ")}`,
      400,
    );
  }
  return value;
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
    sortOrder: ensurePositiveInteger(parsed.sortOrder, "sortOrder"),
  };

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
  const supportedFields = ["label", "positive", "negative", "sortOrder"];
  const unsupportedFields = Object.keys(parsed).filter((f) => !supportedFields.includes(f));

  if (unsupportedFields.length > 0) {
    throw new PromptBlockServiceError("Unsupported fields", 400, { unsupportedFields, supportedFields });
  }

  const hasAtLeastOneField = Object.values(parsed).some((v) => v !== undefined);
  if (!hasAtLeastOneField) {
    throw new PromptBlockServiceError("At least one field must be provided", 400);
  }

  const input: PromptBlockUpdateInput = {};
  if (parsed.label !== undefined) input.label = ensureString(parsed.label, "label");
  if (parsed.positive !== undefined) input.positive = ensurePositive(parsed.positive, "positive");
  if (parsed.negative !== undefined) input.negative = ensureNullableString(parsed.negative, "negative");
  if (parsed.sortOrder !== undefined) input.sortOrder = ensurePositiveInteger(parsed.sortOrder, "sortOrder");

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
