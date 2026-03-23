import { Prisma } from "@/generated/prisma";
import {
  getRunReviewGroup as getRunReviewGroupInRepository,
  keepRunImages as keepRunImagesInRepository,
  restoreImage as restoreImageInRepository,
  trashRunImages as trashRunImagesInRepository,
} from "@/server/repositories/review-repository";

type ReviewRequestBody = {
  imageIds?: unknown;
  reason?: unknown;
};

class ReviewServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ReviewServiceError";
  }
}

function parseReviewRequestBody(body: unknown): ReviewRequestBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReviewServiceError("Request body must be an object", 400);
  }

  return body as ReviewRequestBody;
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

export async function keepRunImages(runId: string, body: unknown) {
  const { imageIds } = parseReviewRequestBody(body);

  return keepRunImagesInRepository(
    normalizeRequiredId(runId, "runId"),
    normalizeImageIds(imageIds),
  );
}

export async function trashRunImages(runId: string, body: unknown) {
  const { imageIds, reason } = parseReviewRequestBody(body);

  return trashRunImagesInRepository(
    normalizeRequiredId(runId, "runId"),
    normalizeImageIds(imageIds),
    normalizeReason(reason),
  );
}

export async function restoreImage(imageId: string) {
  return restoreImageInRepository(normalizeRequiredId(imageId, "imageId"));
}

export async function getRunReviewGroup(runId: string) {
  return getRunReviewGroupInRepository(normalizeRequiredId(runId, "runId"));
}

export function mapReviewError(error: unknown) {
  if (error instanceof ReviewServiceError) {
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
