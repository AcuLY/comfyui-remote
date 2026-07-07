import { Prisma } from "@/generated/prisma";
import { ActorType } from "@/lib/db-enums";
import {
  getRunAgentContext as getRunAgentContextInRepository,
  getRunReviewGroup as getRunReviewGroupInRepository,
  keepRunImages as keepRunImagesInRepository,
  restoreImage as restoreImageInRepository,
  setGenerationImageCover as setGenerationImageCoverInRepository,
  trashRunImages as trashRunImagesInRepository,
} from "@/server/repositories/review-repository";
import { audit, auditMany } from "@/server/services/audit-service";
import {
  ServiceValidationError,
  parseRequestBody,
} from "@/server/services/validation-utils";

type ReviewRequestBody = {
  imageIds?: unknown;
  reason?: unknown;
};

class ReviewServiceError extends ServiceValidationError {
  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message, status, details);
    this.name = "ReviewServiceError";
  }
}

function normalizeRequiredId(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new ReviewServiceError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

function normalizeImageIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ReviewServiceError("imageIds is required", 400);
  }

  const imageIds = [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];

  if (imageIds.length === 0) {
    throw new ReviewServiceError("imageIds is required", 400);
  }

  return imageIds;
}

function normalizeReason(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ReviewServiceError("reason must be a string", 400);
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

export async function keepRunImages(runId: string, body: unknown, actorType: ActorType = ActorType.user) {
  const { imageIds } = parseRequestBody<ReviewRequestBody>(body);
  const normalizedRunId = normalizeRequiredId(runId, "runId");
  const normalizedImageIds = normalizeImageIds(imageIds);

  const result = await keepRunImagesInRepository(normalizedRunId, normalizedImageIds);
  auditMany(normalizedImageIds.map((id) => ({
    entityType: "ImageResult" as const,
    entityId: id,
    action: "keep" as const,
    payload: { runId: normalizedRunId },
    actorType,
  })));
  return result;
}

export async function trashRunImages(runId: string, body: unknown, actorType: ActorType = ActorType.user) {
  const { imageIds, reason } = parseRequestBody<ReviewRequestBody>(body);
  const normalizedRunId = normalizeRequiredId(runId, "runId");
  const normalizedImageIds = normalizeImageIds(imageIds);
  const normalizedReason = normalizeReason(reason);

  const result = await trashRunImagesInRepository(normalizedRunId, normalizedImageIds, normalizedReason);
  auditMany(normalizedImageIds.map((id) => ({
    entityType: "ImageResult" as const,
    entityId: id,
    action: "trash" as const,
    payload: { runId: normalizedRunId, reason: normalizedReason ?? null },
    actorType,
  })));
  return result;
}

export async function restoreImage(imageId: string, actorType: ActorType = ActorType.user) {
  const normalizedId = normalizeRequiredId(imageId, "imageId");
  const result = await restoreImageInRepository(normalizedId);
  audit("ImageResult", normalizedId, "restore", null, actorType);
  return result;
}

export async function setGenerationImageCover(imageId: string, actorType: ActorType = ActorType.user) {
  const normalizedId = normalizeRequiredId(imageId, "imageId");
  const result = await setGenerationImageCoverInRepository(normalizedId);
  audit("ImageResult", normalizedId, "update", { projectId: result.projectId, cover: true }, actorType);
  return result;
}

export async function getRunReviewGroup(runId: string) {
  return getRunReviewGroupInRepository(normalizeRequiredId(runId, "runId"));
}

export async function getRunAgentContext(runId: string) {
  return getRunAgentContextInRepository(normalizeRequiredId(runId, "runId"));
}

export function mapReviewError(error: unknown) {
  if (error instanceof ServiceValidationError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (!(error instanceof Error)) {
    return {
      message: "Unexpected review error",
      status: 500,
      details: String(error),
    };
  }

  switch (error.message) {
    case "RUN_NOT_FOUND":
      return { message: "Run not found", status: 404 };
    case "IMAGES_NOT_FOUND":
      return { message: "One or more images were not found in this run", status: 404 };
    case "IMAGE_NOT_FOUND":
      return { message: "Image not found", status: 404 };
    case "IMAGE_TRASHED":
      return { message: "不能将已删除图片设为封面", status: 409 };
    case "TRASH_RECORD_NOT_FOUND":
      return { message: "Image is not currently in trash", status: 404 };
    default:
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return {
          message: "Database request failed",
          status: 500,
          details: error.message,
        };
      }

      return {
        message: "Unexpected review error",
        status: 500,
        details: error.message,
      };
  }
}
