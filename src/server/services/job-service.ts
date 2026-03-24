import { Prisma } from "@/generated/prisma";
import { ActorType } from "@/lib/db-enums";
import {
  createJob as createJobInRepository,
  copyJob as copyJobInRepository,
  enqueueJobPositionRun as enqueueJobPositionRunInRepository,
  enqueueJobRuns as enqueueJobRunsInRepository,
  listJobs as listJobsInRepository,
  updateJob as updateJobInRepository,
  updateJobPosition as updateJobPositionInRepository,
} from "@/server/repositories/job-repository";
import { audit } from "@/server/services/audit-service";
import { createJobRevision } from "@/server/services/revision-service";

type CreateJobRequestBody = {
  title?: unknown;
  characterId?: unknown;
  scenePresetId?: unknown;
  stylePresetId?: unknown;
  positionTemplateIds?: unknown;
  notes?: unknown;
};

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

const JOB_CREATE_FIELDS = [
  "title",
  "characterId",
  "scenePresetId",
  "stylePresetId",
  "positionTemplateIds",
  "notes",
] as const;

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

function normalizeRequiredStringField(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new JobServiceError(`${fieldName} is required`, 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new JobServiceError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
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

function normalizeNullableIdField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new JobServiceError(`${fieldName} must be a string or null`, 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new JobServiceError(`${fieldName} must not be empty`, 400);
  }

  return normalizedValue;
}

function normalizeNullableNotesField(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  if (typeof value !== "string") {
    throw new JobServiceError(`${fieldName} must be a string or null`, 400);
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function normalizePositionTemplateIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new JobServiceError("positionTemplateIds must be a non-empty array", 400);
  }

  const normalizedIds = value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new JobServiceError(`positionTemplateIds[${index}] must be a string`, 400);
    }

    const normalizedValue = entry.trim();

    if (!normalizedValue) {
      throw new JobServiceError(`positionTemplateIds[${index}] must not be empty`, 400);
    }

    return normalizedValue;
  });
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];

  for (const id of normalizedIds) {
    if (seenIds.has(id)) {
      duplicateIds.push(id);
      continue;
    }

    seenIds.add(id);
  }

  if (duplicateIds.length > 0) {
    throw new JobServiceError("positionTemplateIds must not contain duplicates", 400, {
      duplicatePositionTemplateIds: [...new Set(duplicateIds)],
    });
  }

  return normalizedIds;
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

export async function createJob(body: unknown, actorType: ActorType = ActorType.user) {
  const parsedBody = parsePatchRequestBody<CreateJobRequestBody>(body);
  ensureSupportedFields(parsedBody, JOB_CREATE_FIELDS);

  const input = {
    title: normalizeRequiredStringField(parsedBody.title, "title"),
    characterId: normalizeRequiredStringField(parsedBody.characterId, "characterId"),
    scenePresetId: normalizeNullableIdField(parsedBody.scenePresetId, "scenePresetId") ?? null,
    stylePresetId: normalizeNullableIdField(parsedBody.stylePresetId, "stylePresetId") ?? null,
    positionTemplateIds: normalizePositionTemplateIds(parsedBody.positionTemplateIds),
    notes: normalizeNullableNotesField(parsedBody.notes, "notes"),
  };

  const result = await createJobInRepository(input);
  audit("CompleteJob", result.id, "create", { title: input.title }, actorType);
  return result;
}

export async function updateJob(jobId: string, body: unknown, actorType: ActorType = ActorType.user) {
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

  const normalizedId = normalizeRequiredId(jobId, "jobId");

  // Snapshot before update (best-effort, non-blocking)
  await createJobRevision(normalizedId, actorType);

  const result = await updateJobInRepository(normalizedId, input);

  // Strip undefined values for clean audit payload
  const changedFields = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
  audit("CompleteJob", normalizedId, "update", changedFields, actorType);

  return result;
}

export async function updateJobPosition(
  jobId: string,
  jobPositionId: string,
  body: unknown,
  actorType: ActorType = ActorType.user,
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

  const normalizedJobId = normalizeRequiredId(jobId, "jobId");
  const normalizedJobPositionId = normalizeRequiredId(jobPositionId, "jobPositionId");

  // Snapshot before update (best-effort, non-blocking)
  await createJobRevision(normalizedJobId, actorType);

  const result = await updateJobPositionInRepository(
    normalizedJobId,
    normalizedJobPositionId,
    input,
  );

  const changedFields = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
  audit("CompleteJobPosition", normalizedJobPositionId, "update", changedFields, actorType);

  return result;
}

export async function enqueueJobRuns(jobId: string, actorType: ActorType = ActorType.user) {
  const normalizedId = normalizeRequiredId(jobId, "jobId");
  const result = await enqueueJobRunsInRepository(normalizedId);
  audit("CompleteJob", normalizedId, "enqueue", { queuedRunCount: result.queuedRunCount }, actorType);
  return result;
}

export async function copyJob(jobId: string, actorType: ActorType = ActorType.user) {
  const normalizedId = normalizeRequiredId(jobId, "jobId");
  const result = await copyJobInRepository(normalizedId);
  audit("CompleteJob", result.id, "copy", { sourceJobId: normalizedId }, actorType);
  return result;
}

export async function enqueueJobPositionRun(
  jobId: string,
  jobPositionId: string,
  actorType: ActorType = ActorType.user,
) {
  const normalizedJobPositionId = normalizeRequiredId(jobPositionId, "jobPositionId");
  const result = await enqueueJobPositionRunInRepository(
    normalizeRequiredId(jobId, "jobId"),
    normalizedJobPositionId,
  );
  audit("CompleteJobPosition", normalizedJobPositionId, "enqueue", { jobId }, actorType);
  return result;
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
    case "CHARACTER_NOT_FOUND":
      return { message: "Character not found", status: 404 };
    case "SCENE_PRESET_NOT_FOUND":
      return { message: "Scene preset not found", status: 404 };
    case "STYLE_PRESET_NOT_FOUND":
      return { message: "Style preset not found", status: 404 };
    case "JOB_NOT_FOUND":
      return { message: "Job not found", status: 404 };
    case "POSITION_TEMPLATE_NOT_FOUND":
      return { message: "Position template not found", status: 404 };
    case "POSITION_TEMPLATE_DISABLED":
      return { message: "Position template is disabled", status: 409 };
    case "JOB_POSITION_NOT_FOUND":
      return { message: "Job position not found", status: 404 };
    case "JOB_HAS_NO_ENABLED_POSITIONS":
      return { message: "Job has no enabled positions to queue", status: 409 };
    case "JOB_POSITION_DISABLED":
      return { message: "Job position is disabled", status: 409 };
    case "JOB_SLUG_EXHAUSTED":
    case "JOB_COPY_IDENTITY_EXHAUSTED":
      return { message: "Unable to generate a unique job identity", status: 409 };
    default:
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return {
            message: "Database uniqueness check failed",
            status: 409,
            details: error.meta?.target ?? error.message,
          };
        }

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
