import { Prisma } from "@/generated/prisma";
import {
  copyJob as copyJobInRepository,
  enqueueJobPositionRun as enqueueJobPositionRunInRepository,
  enqueueJobRuns as enqueueJobRunsInRepository,
  listJobs as listJobsInRepository,
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

type ListJobsQuery = {
  search?: unknown;
  status?: unknown;
  enabledOnly?: unknown;
  hasPending?: unknown;
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

function normalizeOptionalSearch(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new JobServiceError("search must be a string", 400);
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

const SUPPORTED_JOB_STATUSES = ["draft", "queued", "running", "partial_done", "done", "failed"] as const;

function normalizeOptionalJobStatus(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new JobServiceError("status must be a string", 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (!SUPPORTED_JOB_STATUSES.includes(normalizedValue as (typeof SUPPORTED_JOB_STATUSES)[number])) {
    throw new JobServiceError("status must be a valid job status", 400, {
      supportedStatuses: SUPPORTED_JOB_STATUSES,
    });
  }

  return normalizedValue as (typeof SUPPORTED_JOB_STATUSES)[number];
}

function normalizeOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      return undefined;
    }

    if (normalizedValue === "true" || normalizedValue === "1") {
      return true;
    }

    if (normalizedValue === "false" || normalizedValue === "0") {
      return false;
    }
  }

  throw new JobServiceError(`${fieldName} must be a boolean`, 400);
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

export async function listJobs(query: ListJobsQuery = {}) {
  return listJobsInRepository({
    search: normalizeOptionalSearch(query.search),
    status: normalizeOptionalJobStatus(query.status),
    enabledOnly: normalizeOptionalBoolean(query.enabledOnly, "enabledOnly"),
    hasPending: normalizeOptionalBoolean(query.hasPending, "hasPending"),
  });
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

export async function enqueueJobRuns(jobId: string) {
  return enqueueJobRunsInRepository(normalizeRequiredId(jobId, "jobId"));
}

export async function copyJob(jobId: string) {
  return copyJobInRepository(normalizeRequiredId(jobId, "jobId"));
}

export async function enqueueJobPositionRun(
  jobId: string,
  jobPositionId: string,
) {
  return enqueueJobPositionRunInRepository(
    normalizeRequiredId(jobId, "jobId"),
    normalizeRequiredId(jobPositionId, "jobPositionId"),
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
    case "JOB_HAS_NO_ENABLED_POSITIONS":
      return { message: "Job has no enabled positions to queue", status: 409 };
    case "JOB_POSITION_DISABLED":
      return { message: "Job position is disabled", status: 409 };
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
