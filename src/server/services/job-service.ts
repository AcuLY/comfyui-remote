import { Prisma } from "@/generated/prisma";
import {
  updateJob as updateJobInRepository,
  updateJobPosition as updateJobPositionInRepository,
} from "@/server/repositories/job-repository";

type UpdateJobRequestBody = {
  characterPrompt?: unknown;
  scenePrompt?: unknown;
  stylePrompt?: unknown;
  characterLoraPath?: unknown;
  aspectRatio?: unknown;
  batchSize?: unknown;
};

type UpdateJobPositionRequestBody = {
  positivePrompt?: unknown;
  negativePrompt?: unknown;
  aspectRatio?: unknown;
  batchSize?: unknown;
  seedPolicy?: unknown;
};

const JOB_UPDATE_FIELDS = [
  "characterPrompt",
  "scenePrompt",
  "stylePrompt",
  "characterLoraPath",
  "aspectRatio",
  "batchSize",
] as const;

const JOB_POSITION_UPDATE_FIELDS = [
  "positivePrompt",
  "negativePrompt",
  "aspectRatio",
  "batchSize",
  "seedPolicy",
] as const;

class JobServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "JobServiceError";
  }
}

function parsePatchRequestBody<T extends Record<string, unknown>>(body: unknown): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new JobServiceError("Request body must be an object", 400);
  }

  return body as T;
}

function normalizeRequiredId(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new JobServiceError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

function ensureSupportedFields(
  body: Record<string, unknown>,
  supportedFields: readonly string[],
) {
  const unsupportedFields = Object.keys(body).filter((field) => !supportedFields.includes(field));

  if (unsupportedFields.length > 0) {
    throw new JobServiceError("Unsupported fields in request body", 400, {
      unsupportedFields,
      supportedFields,
    });
  }
}

function normalizeStringField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new JobServiceError(`${fieldName} must be a string`, 400);
  }

  return value;
}

function normalizeNullableStringField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new JobServiceError(`${fieldName} must be a string or null`, 400);
  }

  return value;
}

function normalizeBatchSize(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new JobServiceError(`${fieldName} must be a positive integer or null`, 400);
  }

  return value;
}

function ensureAtLeastOneField(
  fields: Record<string, unknown>,
  message: string,
  supportedFields: readonly string[],
) {
  const hasAtLeastOneField = Object.values(fields).some((value) => value !== undefined);

  if (!hasAtLeastOneField) {
    throw new JobServiceError(message, 400, { supportedFields });
  }
}

export async function updateJob(jobId: string, body: unknown) {
  const parsedBody = parsePatchRequestBody<UpdateJobRequestBody>(body);
  ensureSupportedFields(parsedBody, JOB_UPDATE_FIELDS);

  const input = {
    characterPrompt: normalizeStringField(parsedBody.characterPrompt, "characterPrompt"),
    scenePrompt: normalizeNullableStringField(parsedBody.scenePrompt, "scenePrompt"),
    stylePrompt: normalizeNullableStringField(parsedBody.stylePrompt, "stylePrompt"),
    characterLoraPath: normalizeStringField(parsedBody.characterLoraPath, "characterLoraPath"),
    aspectRatio: normalizeNullableStringField(parsedBody.aspectRatio, "aspectRatio"),
    batchSize: normalizeBatchSize(parsedBody.batchSize, "batchSize"),
  };

  ensureAtLeastOneField(
    input,
    "At least one editable job field is required",
    JOB_UPDATE_FIELDS,
  );

  return updateJobInRepository(normalizeRequiredId(jobId, "jobId"), input);
}

export async function updateJobPosition(
  jobId: string,
  jobPositionId: string,
  body: unknown,
) {
  const parsedBody = parsePatchRequestBody<UpdateJobPositionRequestBody>(body);
  ensureSupportedFields(parsedBody, JOB_POSITION_UPDATE_FIELDS);

  const input = {
    positivePrompt: normalizeNullableStringField(parsedBody.positivePrompt, "positivePrompt"),
    negativePrompt: normalizeNullableStringField(parsedBody.negativePrompt, "negativePrompt"),
    aspectRatio: normalizeNullableStringField(parsedBody.aspectRatio, "aspectRatio"),
    batchSize: normalizeBatchSize(parsedBody.batchSize, "batchSize"),
    seedPolicy: normalizeNullableStringField(parsedBody.seedPolicy, "seedPolicy"),
  };

  ensureAtLeastOneField(
    input,
    "At least one editable position field is required",
    JOB_POSITION_UPDATE_FIELDS,
  );

  return updateJobPositionInRepository(
    normalizeRequiredId(jobId, "jobId"),
    normalizeRequiredId(jobPositionId, "jobPositionId"),
    input,
  );
}

export function mapJobError(error: unknown) {
  if (error instanceof JobServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (!(error instanceof Error)) {
    return {
      message: "Unexpected job error",
      status: 500,
      details: String(error),
    };
  }

  switch (error.message) {
    case "JOB_NOT_FOUND":
      return { message: "Job not found", status: 404 };
    case "JOB_POSITION_NOT_FOUND":
      return { message: "Job position not found", status: 404 };
    default:
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return {
          message: "Database request failed",
          status: 500,
          details: error.message,
        };
      }

      return {
        message: "Unexpected job error",
        status: 500,
        details: error.message,
      };
  }
}
